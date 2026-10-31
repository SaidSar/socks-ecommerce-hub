using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.DTOs;

public class OrderItemRequestDto
{
    [Required(ErrorMessage = "Falta el SKU.")]
    [StringLength(20)]
    public string? Sku { get; init; }

    [Range(1, 99, ErrorMessage = "La cantidad va de 1 a 99.")]
    public int Quantity { get; init; }
}

/// <summary>Entrada de <c>POST /api/orders</c> (DESIGN_CHECKOUT §6.1). Sin precios: los calcula el servidor (R-13).</summary>
public class OrderRequestDto : IValidatableObject
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

    [Required(ErrorMessage = "Escriba un teléfono de 10 dígitos.")]
    [RegularExpression("^[0-9]{10}$", ErrorMessage = "Escriba un teléfono de 10 dígitos.")]
    public string? Phone { get; init; }

    [Required(ErrorMessage = "Escriba la calle y el número.")]
    [StringLength(150)]
    public string? Street { get; init; }

    [Required(ErrorMessage = "Escriba la colonia.")]
    [StringLength(100)]
    public string? Neighborhood { get; init; }

    [Required(ErrorMessage = "Escriba la ciudad.")]
    [StringLength(80)]
    public string? City { get; init; }

    [Required(ErrorMessage = "Escriba el estado.")]
    [StringLength(40)]
    public string? State { get; init; }

    [Required(ErrorMessage = "El código postal debe tener 5 dígitos.")]
    [RegularExpression("^[0-9]{5}$", ErrorMessage = "El código postal debe tener 5 dígitos.")]
    public string? PostalCode { get; init; }

    [StringLength(250)]
    public string? References { get; init; }

    public bool GiftWrap { get; init; } = true;

    [Required(ErrorMessage = "Elija una forma de pago.")]
    public PaymentMethod? PaymentMethod { get; init; }

    [StringLength(200)]
    public string? PaymentToken { get; init; }

    /// <summary>El total que vio el cliente. Nunca se cobra: solo evita cobrar algo distinto.</summary>
    public decimal? ExpectedTotal { get; init; }

    [Required(ErrorMessage = "Su bolsa está vacía.")]
    [MinLength(1, ErrorMessage = "Su bolsa está vacía.")]
    [MaxLength(50, ErrorMessage = "El pedido tiene demasiadas líneas.")]
    public List<OrderItemRequestDto>? Items { get; init; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (PaymentMethod == Models.Enums.PaymentMethod.Tarjeta && string.IsNullOrWhiteSpace(PaymentToken))
        {
            yield return new ValidationResult("Revise los datos de la tarjeta.", [nameof(PaymentToken)]);
        }
    }

    public CheckoutCommand ToCommand(int? userId, string? idempotencyKey) => new(
        userId,
        FirstName!,
        LastName!,
        Email!,
        Phone!,
        Street!,
        Neighborhood!,
        City!,
        State!,
        PostalCode!,
        References,
        GiftWrap,
        PaymentMethod!.Value,
        PaymentToken,
        ExpectedTotal,
        Items!.Select(i => new CheckoutLine(i.Sku!, i.Quantity)).ToList(),
        idempotencyKey);
}

public record OrderItemDto(string Sku, string Name, string Color, string Size, int Quantity, decimal UnitPrice, decimal LineTotal);

public record OrderTimelineDto(OrderStatus Status, DateTime At);

/// <summary>Pedido para el cliente (DESIGN_CHECKOUT §6.2). Nunca lleva la nota interna ni costos.</summary>
public record OrderDto(
    string Folio,
    OrderStatus Status,
    PaymentMethod PaymentMethod,
    PaymentStatus PaymentStatus,
    string? PaymentReference,
    DateTime? OxxoExpiresAt,
    DateTime? PaidAt,
    DeliveryMethod DeliveryMethod,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string Street,
    string Neighborhood,
    string City,
    string State,
    string PostalCode,
    string? References,
    bool GiftWrap,
    decimal Subtotal,
    decimal ShippingCost,
    decimal Total,
    decimal TaxRate,
    decimal TaxIncluded,
    DateTime CreatedAt,
    IReadOnlyList<OrderItemDto> Items,
    IReadOnlyList<OrderTimelineDto> Timeline)
{
    public static OrderDto From(Order o, TimeSpan oxxoLifetime) => new(
        o.Folio,
        o.Status,
        o.PaymentMethod,
        o.PaymentStatus,
        o.PaymentReference,
        o.PaymentMethod == Models.Enums.PaymentMethod.OxxoPay && o.PaymentStatus == Models.Enums.PaymentStatus.Pendiente && o.Status != OrderStatus.Cancelado
            ? o.CreatedAt + oxxoLifetime
            : null,
        o.PaidAt,
        o.DeliveryMethod,
        o.CustomerFirstName,
        o.CustomerLastName,
        o.CustomerEmail,
        o.CustomerPhone,
        o.ShipStreet,
        o.ShipNeighborhood,
        o.ShipCity,
        o.ShipState,
        o.ShipPostalCode,
        o.ShipReferences,
        o.GiftWrap,
        o.Subtotal,
        o.ShippingCost,
        o.Total,
        o.TaxRate,
        o.TaxIncluded,
        o.CreatedAt,
        o.Items.OrderBy(i => i.Id).Select(i => new OrderItemDto(i.SkuSnapshot, i.ProductNameSnapshot, i.ToneNameSnapshot, i.SizeCodeSnapshot, i.Quantity, i.UnitPrice, i.LineTotal)).ToList(),
        o.StatusHistory.OrderBy(h => h.ChangedAt).ThenBy(h => h.Id).Select(h => new OrderTimelineDto(h.Status, h.ChangedAt)).ToList());
}
