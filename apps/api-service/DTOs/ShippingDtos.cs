using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>Entrada de <c>POST /api/shipping/quote</c>.</summary>
public class ShippingQuoteRequestDto
{
    [Required(ErrorMessage = "Escriba el código postal.")]
    [RegularExpression("^[0-9]{5}$", ErrorMessage = "El código postal debe tener 5 dígitos.")]
    public string? PostalCode { get; init; }

    [Required(ErrorMessage = "Falta el subtotal.")]
    [Range(typeof(decimal), "0", "99999999.99", ErrorMessage = "El subtotal no es válido.")]
    public decimal? Subtotal { get; init; }
}

public record ShippingQuoteDto(DeliveryMethod Method, decimal Cost);
