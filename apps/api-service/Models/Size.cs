using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Talla dentro de un sistema de tallas (DESIGN_DB §3.4).</summary>
public class Size
{
    public int Id { get; set; }
    public SizeSystem SizeSystem { get; set; }
    /// <summary>Sufijo del SKU: <c>S</c>, <c>M</c>, <c>L</c>, <c>U</c>.</summary>
    public string Code { get; set; } = null!;
    public string Label { get; set; } = null!;
    public byte SortOrder { get; set; }
    public bool IsActive { get; set; } = true;
}
