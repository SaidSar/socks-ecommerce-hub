using System.ComponentModel.DataAnnotations;

namespace Sokko.Api.DTOs;

/// <summary>Invitación del Dueño a un miembro del equipo. <c>Role</c> usa los códigos del panel (DESIGN_DB §1.6).</summary>
public class UserInvitationRequestDto
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

    [Required(ErrorMessage = "Elija un rol.")]
    [RegularExpression("^(dueno|operaciones)$", ErrorMessage = "Elija un rol.")]
    public string? Role { get; init; }
}
