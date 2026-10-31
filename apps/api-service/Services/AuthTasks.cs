using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Servicio de tarea: alta de un cliente desde la tienda (DESIGN_DB §6).</summary>
public interface IRegisterCustomer
{
    /// <summary><c>null</c> si el correo ya tiene una cuenta.</summary>
    Task<User?> RegisterAsync(NewCustomer customer, CancellationToken cancellationToken = default);
}

public class RegisterCustomer(IUserService users) : IRegisterCustomer
{
    public Task<User?> RegisterAsync(NewCustomer customer, CancellationToken cancellationToken = default) =>
        users.CreateCustomerAsync(customer, cancellationToken);
}

/// <summary>Dirección pública de la tienda, para armar el enlace del correo.</summary>
public sealed record ResetLinkOptions(string WebStoreUrl);

/// <summary>Servicio de tarea: pedir y aplicar el restablecimiento de contraseña (R-04).</summary>
public interface IResetPassword
{
    /// <summary>Termina igual exista o no la cuenta.</summary>
    Task RequestAsync(string? email, CancellationToken cancellationToken = default);

    /// <summary><c>false</c> si el token no existe, venció o ya se usó.</summary>
    Task<bool> ResetAsync(string token, string newPassword, CancellationToken cancellationToken = default);
}

public class ResetPassword(IUserService users, IAuthService auth, IEmailSender email, IClock clock, ResetLinkOptions link) : IResetPassword
{
    public static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

    public async Task RequestAsync(string? address, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            return;
        }

        var user = await users.FindActiveByEmailAsync(address, cancellationToken);
        if (user is null)
        {
            return;
        }

        var token = auth.CreateResetToken();
        await users.AddResetTokenAsync(user.Id, token.Hash, clock.UtcNow.Add(TokenLifetime), cancellationToken);
        var url = $"{link.WebStoreUrl.TrimEnd('/')}/cuenta/restablecer?token={Uri.EscapeDataString(token.Value)}";
        await email.SendPasswordResetAsync(user.Email, url, cancellationToken);
    }

    public Task<bool> ResetAsync(string token, string newPassword, CancellationToken cancellationToken = default) =>
        users.ResetPasswordAsync(auth.HashResetToken(token), newPassword, cancellationToken);
}
