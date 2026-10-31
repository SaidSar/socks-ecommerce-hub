using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.DTOs;

/// <summary>Mensajes y reglas de DESIGN_AUTH §5.1.</summary>
internal static class AuthRules
{
    public const string Email = @"^\s*[^\s@]+@[^\s@]+\.[^\s@]{2,}\s*$";
    public const string Password = "^(?=.*[A-ZÁÉÍÓÚÑ])(?=.*[a-záéíóúñ])(?=.*[0-9]).{8,128}$";
    public const string PasswordWeak = "La contraseña necesita 8 caracteres, mayúsculas, minúsculas y un número.";
}

public class LoginRequestDto
{
    [Required(ErrorMessage = "Escriba su correo electrónico.")]
    public string? Email { get; init; }

    [Required(ErrorMessage = "Escriba su contraseña.")]
    public string? Password { get; init; }
}

public class RegisterRequestDto
{
    [Required(ErrorMessage = "Escriba su nombre.")]
    [StringLength(80)]
    public string? FirstName { get; init; }

    [Required(ErrorMessage = "Escriba su apellido.")]
    [StringLength(80)]
    public string? LastName { get; init; }

    [Required(ErrorMessage = "Escriba su correo electrónico.")]
    [StringLength(254)]
    [RegularExpression(AuthRules.Email, ErrorMessage = "Revise el formato del correo, por ejemplo nombre@dominio.com.")]
    public string? Email { get; init; }

    [Required(ErrorMessage = AuthRules.PasswordWeak)]
    [RegularExpression(AuthRules.Password, ErrorMessage = AuthRules.PasswordWeak)]
    public string? Password { get; init; }

    [RegularExpression("^(S|M|L)$", ErrorMessage = "La talla no existe.")]
    public string? PreferredSize { get; init; }

    public bool MarketingOptIn { get; init; }

    [Range(typeof(bool), "true", "true", ErrorMessage = "Para crear la cuenta debe aceptar los términos y el aviso de privacidad.")]
    public bool AcceptedTerms { get; init; }
}

/// <summary>El correo no se valida: la respuesta es 202 siempre.</summary>
public class ForgotPasswordRequestDto
{
    public string? Email { get; init; }
}

public class ResetPasswordRequestDto
{
    [Required(ErrorMessage = "El enlace no es válido.")]
    public string? Token { get; init; }

    [Required(ErrorMessage = AuthRules.PasswordWeak)]
    [RegularExpression(AuthRules.Password, ErrorMessage = AuthRules.PasswordWeak)]
    public string? NewPassword { get; init; }
}

/// <summary>Usuario de la tienda (DESIGN_AUTH §5.3). Nunca lleva la contraseña ni su hash.</summary>
public record AuthUserDto(int Id, string FirstName, string LastName, string Email, string? PreferredSize, bool MarketingOptIn, DateTime MemberSince)
{
    public static AuthUserDto From(User user) =>
        new(user.Id, user.FirstName, user.LastName, user.Email, user.PreferredSize?.Code, user.MarketingOptIn, user.CreatedAt);
}

public record AuthResponseDto(string AccessToken, int ExpiresIn, AuthUserDto User)
{
    public static AuthResponseDto From(User user, AccessToken token) => new(token.Token, token.ExpiresIn, AuthUserDto.From(user));
}

public record MeResponseDto(AuthUserDto User);

/// <summary>Usuario del panel (<c>adminAuth.js</c>). <c>Role</c> usa los códigos de DESIGN_DB §1.6.</summary>
public record AdminUserDto(int Id, string Name, string Email, string Role)
{
    private static readonly Dictionary<UserRole, string> RoleCodes = new()
    {
        [UserRole.Owner] = "dueno",
        [UserRole.Operations] = "operaciones",
        [UserRole.Customer] = "customer",
    };

    public static AdminUserDto From(User user) => new(user.Id, $"{user.FirstName} {user.LastName}", user.Email, RoleCodes[user.Role]);
}

public record AdminAuthResponseDto(string AccessToken, int ExpiresIn, AdminUserDto User);

public record AdminMeResponseDto(AdminUserDto User);
