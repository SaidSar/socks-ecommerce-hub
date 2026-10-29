using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Cabecera del pedido con copia de los datos del cliente y del envío (DESIGN_DB §3.8).</summary>
public class Order
{
    public int Id { get; set; }
    /// <summary>Lo asigna la secuencia <c>dbo.OrderFolioSeq</c>.</summary>
    public int FolioNumber { get; set; }
    /// <summary>Calculado en BD: <c>SKK-{FolioNumber}</c>. Llave pública del pedido.</summary>
    public string Folio { get; private set; } = null!;
    /// <summary><c>NULL</c> = compra como invitado.</summary>
    public int? UserId { get; set; }
    public string CustomerFirstName { get; set; } = null!;
    public string CustomerLastName { get; set; } = null!;
    public string CustomerEmail { get; set; } = null!;
    public string CustomerPhone { get; set; } = null!;
    public string ShipStreet { get; set; } = null!;
    public string ShipNeighborhood { get; set; } = null!;
    public string ShipCity { get; set; } = null!;
    public string ShipState { get; set; } = null!;
    public string ShipPostalCode { get; set; } = null!;
    public string? ShipReferences { get; set; }
    public DeliveryMethod DeliveryMethod { get; set; }
    public OrderStatus Status { get; set; } = OrderStatus.PorPreparar;
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; } = PaymentStatus.Pendiente;
    public string? PaymentReference { get; set; }
    public DateTime? PaidAt { get; set; }
    public decimal Subtotal { get; set; }
    /// <summary>Tarifa congelada al comprar.</summary>
    public decimal ShippingCost { get; set; }
    public decimal Total { get; set; }
    /// <summary>Copia de <c>Settings.IvaRate</c> al comprar.</summary>
    public decimal TaxRate { get; set; }
    /// <summary>Calculada en BD: IVA incluido en <see cref="Total"/>.</summary>
    public decimal TaxIncluded { get; private set; }
    /// <summary>Furoshiki; verdadero por defecto y sin costo.</summary>
    public bool GiftWrap { get; set; } = true;
    public string? InternalNote { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    public User? User { get; set; }
    public ICollection<OrderItem> Items { get; set; } = [];
    public ICollection<OrderStatusHistory> StatusHistory { get; set; } = [];
    public Shipment? Shipment { get; set; }
}
