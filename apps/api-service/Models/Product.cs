using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Producto (modelo) del catálogo; el stock vive en sus variantes (DESIGN_DB §3.5).</summary>
public class Product
{
    public int Id { get; set; }
    public ProductLine Line { get; set; }
    /// <summary>Número dentro de su línea y base del SKU (único por línea).</summary>
    public short PieceNumber { get; set; }
    public string Slug { get; set; } = null!;
    public int BrandId { get; set; }
    public int ProductTypeId { get; set; }
    /// <summary>Obligatoria en <see cref="ProductLine.Especiales"/>.</summary>
    public int? CollectionId { get; set; }
    public string Name { get; set; } = null!;
    /// <summary>Kanji; obligatorio solo en <see cref="ProductLine.Sokko"/>.</summary>
    public string? NameJp { get; set; }
    public string Material { get; set; } = null!;
    /// <summary>Precio de lista con IVA por unidad vendible. El precio fuera de temporada se calcula (R-29).</summary>
    public decimal Price { get; set; }
    public byte UnitsPerPack { get; set; } = 1;
    public int? EditionSize { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    /// <summary>Concurrencia optimista de las ediciones del panel (R-25).</summary>
    public byte[] RowVersion { get; set; } = null!;

    public Brand Brand { get; set; } = null!;
    public ProductType ProductType { get; set; } = null!;
    public Collection? Collection { get; set; }
    public ICollection<ProductVariant> Variants { get; set; } = [];
}
