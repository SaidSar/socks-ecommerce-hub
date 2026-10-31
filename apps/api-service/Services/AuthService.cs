using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Firma de los JWT. La clave sale de <c>Jwt:SigningKey</c>; nunca de appsettings.</summary>
public sealed record JwtOptions(string Issuer, string Audience, byte[] SigningKey, TimeSpan Lifetime)
{
    private const int MinKeyBytes = 32;

    /// <summary>
    /// Sin clave fuera de Development, la app no arranca. En Development usa una clave temporal, así que las sesiones
    /// se pierden al reiniciar la API hasta configurar <c>dotnet user-secrets set Jwt:SigningKey</c>.
    /// </summary>
    public static JwtOptions FromConfiguration(IConfiguration configuration, bool isDevelopment)
    {
        var configured = configuration["Jwt:SigningKey"];
        byte[] key;
        if (!string.IsNullOrEmpty(configured))
        {
            key = Encoding.UTF8.GetBytes(configured);
            if (key.Length < MinKeyBytes)
            {
                throw new InvalidOperationException($"Jwt:SigningKey debe tener al menos {MinKeyBytes} bytes.");
            }
        }
        else if (isDevelopment)
        {
            key = RandomNumberGenerator.GetBytes(64);
        }
        else
        {
            throw new InvalidOperationException("Falta Jwt:SigningKey (variable Jwt__SigningKey).");
        }

        return new JwtOptions(
            configuration["Jwt:Issuer"] ?? "sokko-api",
            configuration["Jwt:Audience"] ?? "sokko",
            key,
            TimeSpan.FromMinutes(configuration.GetValue("Jwt:LifetimeMinutes", 120)));
    }

    public TokenValidationParameters ValidationParameters() => new()
    {
        ValidIssuer = Issuer,
        ValidAudience = Audience,
        IssuerSigningKey = new SymmetricSecurityKey(SigningKey),
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = JwtRegisteredClaimNames.Sub,
        RoleClaimType = AuthClaims.Role,
    };
}

public static class AuthClaims
{
    public const string Role = "role";
}

public record AccessToken(string Token, int ExpiresIn);

/// <summary>Token de restablecimiento: el valor en claro solo viaja en el correo; en BD va su SHA-256.</summary>
public record ResetToken(string Value, byte[] Hash);

public enum PasswordCheck
{
    Failed,
    Success,
    SuccessRehashNeeded,
}

/// <summary>Servicio de utilidad: hash de contraseñas y JWT (DESIGN_DB §6).</summary>
public interface IAuthService
{
    string HashPassword(User user, string password);

    PasswordCheck VerifyPassword(User user, string password);

    /// <summary>Gasta el mismo tiempo que una verificación real, para no revelar si el correo existe.</summary>
    void VerifyAgainstDummy(string password);

    AccessToken IssueToken(User user);

    /// <summary><c>null</c> si el token es inválido o ya venció.</summary>
    Task<ClaimsPrincipal?> ValidateTokenAsync(string token);

    ResetToken CreateResetToken();

    byte[] HashResetToken(string token);
}

public class AuthService(JwtOptions options, IClock clock) : IAuthService
{
    private static readonly PasswordHasher<User> Hasher = new();
    private static readonly User DummyUser = new();
    private static readonly string DummyHash = Hasher.HashPassword(DummyUser, Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)));

    public string HashPassword(User user, string password) => Hasher.HashPassword(user, password);

    public PasswordCheck VerifyPassword(User user, string password) =>
        Hasher.VerifyHashedPassword(user, user.PasswordHash, password) switch
        {
            PasswordVerificationResult.Success => PasswordCheck.Success,
            PasswordVerificationResult.SuccessRehashNeeded => PasswordCheck.SuccessRehashNeeded,
            _ => PasswordCheck.Failed,
        };

    public void VerifyAgainstDummy(string password) => Hasher.VerifyHashedPassword(DummyUser, DummyHash, password);

    public AccessToken IssueToken(User user)
    {
        var now = clock.UtcNow;
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = options.Issuer,
            Audience = options.Audience,
            IssuedAt = now,
            NotBefore = now,
            Expires = now.Add(options.Lifetime),
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(options.SigningKey), SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = user.Id.ToString(),
                [JwtRegisteredClaimNames.Email] = user.Email,
                [AuthClaims.Role] = user.Role.ToString(),
            },
        });
        return new AccessToken(token, (int)options.Lifetime.TotalSeconds);
    }

    public async Task<ClaimsPrincipal?> ValidateTokenAsync(string token)
    {
        var result = await new JsonWebTokenHandler().ValidateTokenAsync(token, options.ValidationParameters());
        return result.IsValid ? new ClaimsPrincipal(result.ClaimsIdentity) : null;
    }

    public ResetToken CreateResetToken()
    {
        var value = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));
        return new ResetToken(value, HashResetToken(value));
    }

    public byte[] HashResetToken(string token) => SHA256.HashData(Encoding.UTF8.GetBytes(token));
}
