namespace Sokko.Api.Models;

/// <summary>SKU vendible (producto × color × talla) con su stock y apartados (DESIGN_DB §3.6).</summary>
public class ProductVariant
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ColorCode { get; set; } = null!;
    public int SizeId { get; set; }
    /// <summary><c>{SKK·MRC·ESP·ACC}-###-XXX-T</c>, por ejemplo <c>SKK-007-SUM-M</c>.</summary>
    public string Sku { get; set; } = null!;
    public string? Barcode { get; set; }
    /// <summary>Costo por unidad vendible; solo lo recibe el Dueño (R-30).</summary>
    public decimal? UnitCost { get; set; }
    public int Stock { get; set; }
    /// <summary>Apartado por pedidos sin enviar. Disponible = <see cref="Stock"/> − <see cref="Reserved"/>.</summary>
    public int Reserved { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Concurrencia optimista solo para ediciones del panel (DESIGN_DB §4.1).</summary>
    public byte[] RowVersion { get; set; } = null!;

    public Product Product { get; set; } = null!;
    public Color Color { get; set; } = null!;
    public Size Size { get; set; } = null!;
    public ICollection<InventoryMovement> Movements { get; set; } = [];
}
