using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models;

namespace Sokko.Api.DTOs;

/// <summary>Formulario de contacto de la tienda. Mismos límites y mensajes que <c>web-store/src/domain/contact.js</c>.</summary>
public class ContactRequestDto
{
    [Required(ErrorMessage = "Escriba su nombre.")]
    [StringLength(ContactMessageLimits.Name, ErrorMessage = "El nombre admite hasta 80 caracteres.")]
    public string? Name { get; init; }

    [Required(ErrorMessage = "Escriba su correo electrónico.")]
    [StringLength(ContactMessageLimits.Email)]
    [RegularExpression(AuthRules.Email, ErrorMessage = "Revise el formato del correo, por ejemplo nombre@dominio.com.")]
    public string? Email { get; init; }

    [Required(ErrorMessage = "Elija un asunto.")]
    [StringLength(ContactMessageLimits.Subject, ErrorMessage = "Elija un asunto.")]
    public string? Subject { get; init; }

    [Required(ErrorMessage = "Escriba su mensaje.")]
    [StringLength(ContactMessageLimits.Message, MinimumLength = ContactMessageLimits.MessageMin, ErrorMessage = "El mensaje necesita entre 10 y 2000 caracteres.")]
    public string? Message { get; init; }

    /// <summary>Honeypot: el campo está oculto en la tienda; si llega con texto, lo llenó un bot.</summary>
    public string? Website { get; init; }
}
