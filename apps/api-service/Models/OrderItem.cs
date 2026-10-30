namespace Sokko.Api.Models;

/// <summary>Línea del pedido con precio histórico y copias del catálogo (DESIGN_DB §3.9).</summary>
public class OrderItem
{
    public int Id { get; set; }
    public int OrderId { get; set; }
    public int VariantId { get; set; }
    public string SkuSnapshot { get; set; } = null!;
    public string ProductNameSnapshot { get; set; } = null!;
    /// <summary>Copia de <c>Colors.Name</c> (el nombre de columna se conserva desde v0.3).</summary>
    public string ToneNameSnapshot { get; set; } = null!;
    public string SizeCodeSnapshot { get; set; } = null!;
    public int Quantity { get; set; }
    /// <summary>Precio cobrado, con el descuento de R-29 si aplicaba.</summary>
    public decimal UnitPrice { get; set; }
    /// <summary>Calculada en BD: <c>Quantity * UnitPrice</c>.</summary>
    public decimal LineTotal { get; private set; }

    public Order Order { get; set; } = null!;
    public ProductVariant Variant { get; set; } = null!;
}
