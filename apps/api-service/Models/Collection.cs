using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>
/// Colección de temporada (ventana anual recurrente, inclusiva, puede cruzar de año) o temática (DESIGN_DB §3.5c).
/// </summary>
public class Collection
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public CollectionKind Kind { get; set; }
    public byte? StartMonth { get; set; }
    public byte? StartDay { get; set; }
    public byte? EndMonth { get; set; }
    public byte? EndDay { get; set; }
    /// <summary>Calculada en BD: <c>StartMonth * 100 + StartDay</c> (1101 = 1-nov).</summary>
    public int? StartKey { get; private set; }
    /// <summary>Calculada en BD: <c>EndMonth * 100 + EndDay</c> (106 = 6-ene).</summary>
    public int? EndKey { get; private set; }
    /// <summary>Descuento fuera de temporada (R-29); 0.3000 = 30 %.</summary>
    public decimal OffSeasonDiscountPct { get; set; } = 0.30m;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public ICollection<Product> Products { get; set; } = [];
}
