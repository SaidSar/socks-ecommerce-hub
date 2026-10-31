using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>Códigos de API de la paquetería, a mano para no depender de cómo se parten las siglas (DESIGN_DB §1.6).</summary>
public static class CarrierCodes
{
    public const string Estafeta = "estafeta";
    public const string DhlExpress = "dhl_express";

    public static string ToCode(Carrier carrier) => carrier switch
    {
        Carrier.Estafeta => Estafeta,
        Carrier.DHLExpress => DhlExpress,
        _ => throw new ArgumentOutOfRangeException(nameof(carrier)),
    };

    public static Carrier? Parse(string? code) => code switch
    {
        Estafeta => Carrier.Estafeta,
        DhlExpress => Carrier.DHLExpress,
        _ => null,
    };
}

public record AdminOrderCustomerDto(string Name, string Email, string City, string PostalCode, int Orders);

public record AdminOrderHistoryDto(OrderStatus Status, DateTime At, string By);

/// <summary>Partida para Operaciones (R-24): este tipo no tiene el precio, no lo lleva en <c>null</c>.</summary>
public record OperationsOrderItemDto(string Sku, string Name, string Tone, string ToneName, string ToneHex, string Size, int Qty, string Unit);

public record OwnerOrderItemDto(string Sku, string Name, string Tone, string ToneName, string ToneHex, string Size, int Qty, string Unit, decimal Price);

/// <summary>Pedido para Operaciones (R-24): sin importes. De la tarifa de envío solo sabe si fue gratis.</summary>
public record OperationsOrderDto(
    string Id,
    DateTime Created,
    OrderStatus Status,
    IReadOnlyList<OperationsOrderItemDto> Items,
    PaymentMethod Pay,
    PaymentStatus PaymentStatus,
    DateTime? PaidAt,
    AdminOrderCustomerDto Customer,
    DeliveryMethod Delivery,
    bool GiftWrap,
    bool FreeShipping,
    string? Carrier,
    string Tracking,
    string Courier,
    string Note,
    IReadOnlyList<AdminOrderHistoryDto> History,
    byte[] RowVersion);

/// <summary>Pedido para el Dueño: lo mismo que Operaciones, más los importes (R-24).</summary>
public record OwnerOrderDto(
    string Id,
    DateTime Created,
    OrderStatus Status,
    IReadOnlyList<OwnerOrderItemDto> Items,
    PaymentMethod Pay,
    PaymentStatus PaymentStatus,
    DateTime? PaidAt,
    AdminOrderCustomerDto Customer,
    DeliveryMethod Delivery,
    bool GiftWrap,
    bool FreeShipping,
    string? Carrier,
    string Tracking,
    string Courier,
    string Note,
    IReadOnlyList<AdminOrderHistoryDto> History,
    byte[] RowVersion,
    decimal Subtotal,
    decimal Shipping,
    decimal Total,
    decimal TaxIncluded);

/// <summary>Lista de la vista Pedidos. <c>Counts</c> son los contadores de las pestañas, sin la búsqueda.</summary>
public record AdminOrderListDto<TOrder>(IReadOnlyList<TOrder> Orders, IReadOnlyDictionary<string, int> Counts, int Count, DateTime Now);

public record AdminOrderSummaryDto(int ToPrepare, int Late);

public record PackingListItemDto(string Sku, string Name, string ToneName, string Size, int Qty, string Unit);

/// <summary>Lista de empaque: es lo mismo para los dos roles y nunca lleva importes.</summary>
public record PackingListDto(
    string Folio,
    DateTime Created,
    string CustomerName,
    string Phone,
    string Street,
    string Neighborhood,
    string City,
    string State,
    string PostalCode,
    string? References,
    DeliveryMethod Delivery,
    bool GiftWrap,
    string Note,
    IReadOnlyList<PackingListItemDto> Items,
    int Units);

public class OrderNoteRequestDto
{
    [StringLength(500, ErrorMessage = "La nota admite hasta 500 caracteres.")]
    public string? Note { get; init; }

    public byte[]? RowVersion { get; init; }
}

public class OrderVersionRequestDto
{
    public byte[]? RowVersion { get; init; }
}
