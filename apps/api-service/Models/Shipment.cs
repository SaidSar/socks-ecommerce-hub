using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Salida física del pedido: paquetería con guía, o repartidor local (DESIGN_DB §3.11).</summary>
public class Shipment
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    /// <summary>Copia de <c>Orders.DeliveryMethod</c> al crear el envío (R-12).</summary>
    public DeliveryMethod DeliveryMethod { get; set; }
    public Carrier? Carrier { get; set; }
    public string? TrackingNumber { get; set; }
    /// <summary>Repartidor interno.</summary>
    public int? CourierUserId { get; set; }
    /// <summary>Repartidor externo, o copia del nombre del interno.</summary>
    public string? CourierName { get; set; }
    public DateTime ShippedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }

    public Order Order { get; set; } = null!;
    public User? CourierUser { get; set; }
}
