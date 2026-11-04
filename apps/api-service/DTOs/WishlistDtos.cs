using System.ComponentModel.DataAnnotations;
using Sokko.Api.Services;

namespace Sokko.Api.DTOs;

/// <summary>Favoritos que el invitado guardó en su navegador, para unirlos a su cuenta al iniciar sesión.</summary>
public class WishlistMergeRequestDto
{
    [Required(ErrorMessage = "Faltan los productos.")]
    [MaxLength(WishlistService.MaxMerge, ErrorMessage = "Se pueden unir hasta 50 favoritos a la vez.")]
    public List<string>? Slugs { get; init; }
}
