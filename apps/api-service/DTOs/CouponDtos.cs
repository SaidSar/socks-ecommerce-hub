using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>Entrada de <c>POST /api/coupons/preview</c>: solo el código y lo que hay en la bolsa; el servidor pone los precios (R-13).</summary>
public class CouponPreviewRequestDto
{
    [Required(ErrorMessage = "Escriba el código.")]
    [StringLength(40, ErrorMessage = "Este código no existe.")]
    public string? Code { get; init; }

    [Required(ErrorMessage = "Su bolsa está vacía.")]
    [MinLength(1, ErrorMessage = "Su bolsa está vacía.")]
    [MaxLength(50, ErrorMessage = "El pedido tiene demasiadas líneas.")]
    public List<OrderItemRequestDto>? Items { get; init; }

    [RegularExpression("^[0-9]{5}$", ErrorMessage = "El código postal debe tener 5 dígitos.")]
    public string? PostalCode { get; init; }

    [StringLength(254)]
    public string? Email { get; init; }
}

/// <summary>
/// Cotización con el cupón: el mismo cálculo que el checkout. <c>ShippingCost</c> es <c>null</c> sin CP;
/// <c>FreeShippingRemaining</c> es lo que falta (después del descuento) para el envío de cortesía.
/// </summary>
public record CouponPreviewDto(
    string Code,
    CouponType Type,
    string Description,
    decimal Subtotal,
    decimal Discount,
    DeliveryMethod? DeliveryMethod,
    decimal? ShippingCost,
    decimal Total,
    decimal? FreeShippingRemaining);

/// <summary>Cupón para el panel (solo el Dueño). <c>Status</c>: active, scheduled, expired, exhausted o inactive.</summary>
public record AdminCouponDto(
    int Id,
    string Code,
    string? Description,
    CouponType Type,
    decimal Value,
    decimal? MinSubtotal,
    DateOnly? StartsOn,
    DateOnly? EndsOn,
    int? MaxRedemptions,
    bool OnePerCustomer,
    bool IsActive,
    string Status,
    int Redemptions,
    decimal DiscountGiven,
    decimal Sales,
    bool CanDelete,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    byte[] RowVersion);

/// <summary>Alta o edición de un cupón. Al editar, <c>RowVersion</c> es obligatorio (R-25).</summary>
public class AdminCouponRequestDto
{
    [StringLength(40)]
    public string? Code { get; init; }

    [StringLength(200, ErrorMessage = "La descripción admite hasta 200 caracteres.")]
    public string? Description { get; init; }

    public CouponType? Type { get; init; }

    public decimal? Value { get; init; }

    public decimal? MinSubtotal { get; init; }

    public DateOnly? StartsOn { get; init; }

    public DateOnly? EndsOn { get; init; }

    public int? MaxRedemptions { get; init; }

    public bool OnePerCustomer { get; init; }

    public bool IsActive { get; init; } = true;

    public byte[]? RowVersion { get; init; }
}
