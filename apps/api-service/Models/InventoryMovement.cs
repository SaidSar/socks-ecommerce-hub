using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Movimiento del kárdex; solo inserción (DESIGN_DB §3.7).</summary>
public class InventoryMovement
{
    public long Id { get; set; }
    public int VariantId { get; set; }
    public InventoryMovementType Type { get; set; }
    /// <summary>Delta firmado: + entra, − sale.</summary>
    public int Quantity { get; set; }
    /// <summary>Saldo después del movimiento; sale de <c>OUTPUT inserted.Stock</c>.</summary>
    public int Balance { get; set; }
    public string? Note { get; set; }
    /// <summary>Obligatorio en <see cref="InventoryMovementType.Venta"/> y <see cref="InventoryMovementType.Devolucion"/>.</summary>
    public int? OrderId { get; set; }
    /// <summary><c>NULL</c> = proceso automático.</summary>
    public int? CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = null!;
    public DateTime CreatedAt { get; set; }

    public ProductVariant Variant { get; set; } = null!;
    public Order? Order { get; set; }
    public User? CreatedByUser { get; set; }
}
