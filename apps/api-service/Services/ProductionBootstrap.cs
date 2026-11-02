using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>La terminal del bootstrap. Las contraseñas se leen sin eco y nunca se escriben.</summary>
public interface IBootstrapPrompt
{
    string Ask(string question);

    string AskSecret(string question);

    void Say(string message);
}

/// <summary>Terminal real. Con la entrada redirigida (una tubería) lee líneas, sin eco que ocultar.</summary>
public sealed class TerminalPrompt : IBootstrapPrompt
{
    public string Ask(string question)
    {
        Console.Write($"{question}: ");
        return Console.ReadLine()?.Trim() ?? "";
    }

    public string AskSecret(string question)
    {
        Console.Write($"{question}: ");
        if (Console.IsInputRedirected)
        {
            return Console.ReadLine() ?? "";
        }

        var secret = new StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter)
            {
                Console.WriteLine();
                return secret.ToString();
            }
            if (key.Key == ConsoleKey.Backspace)
            {
                if (secret.Length > 0)
                {
                    secret.Length--;
                }
            }
            else if (!char.IsControl(key.KeyChar))
            {
                secret.Append(key.KeyChar);
            }
        }
    }

    public void Say(string message) => Console.WriteLine(message);
}

/// <summary>Una cuenta que crea el bootstrap. Sin <c>Email</c>, se pregunta (la del Dueño).</summary>
public record BootstrapAccount(string? Email, string FirstName, string LastName, UserRole Role, bool StrongPassword);

/// <summary>
/// Carga inicial de producción (<c>dotnet Sokko.Api.dll bootstrap</c>): el catálogo de <see cref="DevelopmentSeed"/> con su stock y
/// kárdex, y las cuentas base. Es idempotente: lo que ya existe no se duplica, y una cuenta existente conserva su contraseña.
/// No crea pedidos ni las cuentas demo de Development.
/// </summary>
public partial class ProductionBootstrap(SokkoDbContext db, IUserService users, IBootstrapPrompt prompt)
{
    public const int StrongMinLength = 12;
    private const int Attempts = 3;

    public static readonly BootstrapAccount[] Accounts =
    [
        new(null, "", "", UserRole.Owner, StrongPassword: true),
        new("daniel@sokko.mx", "Daniel", "Ruiz", UserRole.Operations, StrongPassword: false),
        new("kevin@sokko.mx", "Kevin", "Armenta", UserRole.Operations, StrongPassword: false),
        new("cliente@sokko.mx", "Cliente", "Demo", UserRole.Customer, StrongPassword: false),
    ];

    /// <summary>
    /// Arma el bootstrap sin la clave JWT ni el correo: se corre desde una máquina que solo tiene la cadena de conexión. Para guardar
    /// contraseñas basta el hasher; la clave temporal no firma ningún token.
    /// </summary>
    public static ProductionBootstrap Create(IServiceProvider services, IBootstrapPrompt prompt)
    {
        var db = services.GetRequiredService<SokkoDbContext>();
        var clock = services.GetRequiredService<IClock>();
        var hashing = new AuthService(new JwtOptions("bootstrap", "bootstrap", RandomNumberGenerator.GetBytes(64), TimeSpan.FromMinutes(1)), clock);
        return new ProductionBootstrap(db, new UserService(db, hashing, clock), prompt);
    }

    [GeneratedRegex(AuthRules.Password)]
    private static partial Regex PasswordPattern();

    [GeneratedRegex(AuthRules.Email)]
    private static partial Regex EmailPattern();

    /// <summary>Por qué no sirve la contraseña; <c>null</c> si cumple. El Dueño necesita además <see cref="StrongMinLength"/> caracteres.</summary>
    public static string? CheckPassword(string password, bool strong)
    {
        if (!PasswordPattern().IsMatch(password))
        {
            return AuthRules.PasswordWeak;
        }
        return strong && password.Length < StrongMinLength ? $"La contraseña del Dueño necesita al menos {StrongMinLength} caracteres." : null;
    }

    /// <summary>Devuelve 0 si todo quedó listo; 1 si una cuenta no se pudo crear.</summary>
    public async Task<int> RunAsync(CancellationToken cancellationToken = default)
    {
        prompt.Say("Catálogo: cargando productos, variantes y stock inicial…");
        await DevelopmentDataSeeder.SeedCatalogOnlyAsync(db, cancellationToken);
        prompt.Say($"Catálogo listo: {db.Products.Count()} productos y {db.ProductVariants.Count()} variantes.");

        foreach (var account in Accounts)
        {
            if (!await CreateAsync(account, cancellationToken))
            {
                return 1;
            }
        }
        prompt.Say("Bootstrap terminado.");
        return 0;
    }

    private async Task<bool> CreateAsync(BootstrapAccount account, CancellationToken cancellationToken)
    {
        var email = account.Email;
        var (firstName, lastName) = (account.FirstName, account.LastName);
        if (email is null)
        {
            email = prompt.Ask("Correo del Dueño");
            if (!EmailPattern().IsMatch(email))
            {
                prompt.Say("El correo no es válido.");
                return false;
            }
        }

        var existing = await users.FindByEmailAsync(email, cancellationToken);
        if (existing is not null)
        {
            var note = existing.Role == account.Role ? "" : $" (su rol es {existing.Role}, no se cambia)";
            prompt.Say($"{email}: ya existe; se conserva su contraseña{note}.");
            return true;
        }

        if (account.Email is null)
        {
            firstName = prompt.Ask("Nombre del Dueño");
            lastName = prompt.Ask("Apellido del Dueño");
        }

        for (var attempt = 0; attempt < Attempts; attempt++)
        {
            var password = prompt.AskSecret($"Contraseña para {email}");
            if (CheckPassword(password, account.StrongPassword) is { } problem)
            {
                prompt.Say(problem);
                continue;
            }
            if (prompt.AskSecret("Repítala") != password)
            {
                prompt.Say("Las contraseñas no coinciden.");
                continue;
            }

            await users.CreateAccountAsync(firstName, lastName, email, account.Role, password, cancellationToken);
            prompt.Say($"{email}: creada como {account.Role}.");
            return true;
        }

        prompt.Say($"{email}: no se creó tras {Attempts} intentos.");
        return false;
    }
}
