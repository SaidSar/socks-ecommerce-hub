using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

public record NewCustomer(string FirstName, string LastName, string Email, string Password, string? PreferredSize, bool MarketingOptIn);

/// <summary>Servicio de entidad: único escritor de <c>Users</c> y <c>PasswordResetTokens</c> (DESIGN_DB §6).</summary>
public interface IUserService
{
    Task<User?> GetActiveByIdAsync(int id, CancellationToken cancellationToken = default);

    Task<User?> FindActiveByEmailAsync(string email, CancellationToken cancellationToken = default);

    /// <summary>Usuario activo con esa contraseña, o <c>null</c>. Registra <c>LastLoginAt</c>.</summary>
    Task<User?> ValidateCredentialsAsync(string email, string password, CancellationToken cancellationToken = default);

    /// <summary><c>null</c> si el correo ya tiene una cuenta (R-01).</summary>
    Task<User?> CreateCustomerAsync(NewCustomer customer, CancellationToken cancellationToken = default);

    /// <summary>Guarda el hash del token e invalida los anteriores del usuario.</summary>
    Task AddResetTokenAsync(int userId, byte[] tokenHash, DateTime expiresAt, CancellationToken cancellationToken = default);

    /// <summary><c>false</c> si el token no existe, venció o ya se usó.</summary>
    Task<bool> ResetPasswordAsync(byte[] tokenHash, string newPassword, CancellationToken cancellationToken = default);
}

public class UserService(SokkoDbContext db, IAuthService auth, IClock clock) : IUserService
{
    private const int SqlUniqueIndexViolation = 2601;
    private const int SqlUniqueConstraintViolation = 2627;

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private IQueryable<User> ActiveUsers() => db.Users.Include(u => u.PreferredSize).Where(u => u.IsActive);

    public Task<User?> GetActiveByIdAsync(int id, CancellationToken cancellationToken = default) =>
        ActiveUsers().AsNoTracking().FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

    public Task<User?> FindActiveByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeEmail(email);
        return ActiveUsers().AsNoTracking().FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken);
    }

    public async Task<User?> ValidateCredentialsAsync(string email, string password, CancellationToken cancellationToken = default)
    {
        var normalized = NormalizeEmail(email);
        var user = await ActiveUsers().FirstOrDefaultAsync(u => u.Email == normalized, cancellationToken);
        if (user is null)
        {
            auth.VerifyAgainstDummy(password);
            return null;
        }

        var check = auth.VerifyPassword(user, password);
        if (check == PasswordCheck.Failed)
        {
            return null;
        }
        if (check == PasswordCheck.SuccessRehashNeeded)
        {
            user.PasswordHash = auth.HashPassword(user, password);
        }

        user.LastLoginAt = clock.UtcNow;
        await db.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<User?> CreateCustomerAsync(NewCustomer customer, CancellationToken cancellationToken = default)
    {
        var email = NormalizeEmail(customer.Email);
        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return null;
        }

        var size = customer.PreferredSize is null
            ? null
            : await db.Sizes.FirstOrDefaultAsync(s => s.SizeSystem == SizeSystem.Calceta && s.Code == customer.PreferredSize, cancellationToken);
        var now = clock.UtcNow;
        var user = new User
        {
            FirstName = customer.FirstName.Trim(),
            LastName = customer.LastName.Trim(),
            Email = email,
            Role = UserRole.Customer,
            PreferredSize = size,
            MarketingOptIn = customer.MarketingOptIn,
            AcceptedTermsAt = now,
            LastLoginAt = now,
            CreatedAt = now,
            UpdatedAt = now,
        };
        user.PasswordHash = auth.HashPassword(user, customer.Password);
        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: SqlUniqueIndexViolation or SqlUniqueConstraintViolation })
        {
            // Dos registros simultáneos con el mismo correo: la BD decide (R-01).
            db.Entry(user).State = EntityState.Detached;
            return null;
        }
        return user;
    }

    public async Task AddResetTokenAsync(int userId, byte[] tokenHash, DateTime expiresAt, CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        await db.PasswordResetTokens
            .Where(t => t.UserId == userId && t.UsedAt == null)
            .ExecuteUpdateAsync(u => u.SetProperty(t => t.UsedAt, now), cancellationToken);
        db.PasswordResetTokens.Add(new PasswordResetToken { UserId = userId, TokenHash = tokenHash, CreatedAt = now, ExpiresAt = expiresAt });
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<bool> ResetPasswordAsync(byte[] tokenHash, string newPassword, CancellationToken cancellationToken = default) =>
        // Con EnableRetryOnFailure, una transacción explícita tiene que ir dentro de la estrategia de ejecución.
        db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var now = clock.UtcNow;
            var valid = db.PasswordResetTokens.Where(t => t.TokenHash == tokenHash && t.UsedAt == null && t.ExpiresAt > now && t.User.IsActive);
            var userId = await valid.Select(t => (int?)t.UserId).FirstOrDefaultAsync(cancellationToken);
            // El UPDATE condicionado garantiza un solo uso aunque lleguen dos peticiones a la vez.
            if (userId is null || await valid.ExecuteUpdateAsync(u => u.SetProperty(t => t.UsedAt, now), cancellationToken) != 1)
            {
                return false;
            }

            var user = await db.Users.SingleAsync(u => u.Id == userId, cancellationToken);
            user.PasswordHash = auth.HashPassword(user, newPassword);
            user.UpdatedAt = now;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return true;
        });
}
