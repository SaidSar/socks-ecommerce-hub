using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Qué es el producto; define su sistema de tallas y su unidad (DESIGN_DB §3.5b).</summary>
public class ProductType
{
    public int Id { get; set; }
    /// <summary>Código de API: <c>calcetas</c>, <c>guantes</c>.</summary>
    public string Code { get; set; } = null!;
    public string Name { get; set; } = null!;
    public SizeSystem SizeSystem { get; set; }
    public UnitLabel UnitLabel { get; set; } = UnitLabel.Pieza;
    public byte SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>Concurrencia optimista de las ediciones del panel (R-25).</summary>
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<Product> Products { get; set; } = [];
}
