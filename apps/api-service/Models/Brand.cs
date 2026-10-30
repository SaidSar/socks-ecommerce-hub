namespace Sokko.Api.Models;

/// <summary>Marca propia, revendida, licencia o "Sin marca" (DESIGN_DB §3.5a).</summary>
public class Brand
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string Slug { get; set; } = null!;
    public bool IsOwnBrand { get; set; }
    /// <summary><c>false</c> = no sale en el filtro de marcas ni en <c>/api/catalog/nav</c>.</summary>
    public bool ShowInFilters { get; set; } = true;
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }

    public ICollection<Product> Products { get; set; } = [];
}
