namespace Sokko.Api.Models;

/// <summary>Foto de un producto, guardada en <see cref="Services.IImageStorage"/>. La de menor <see cref="SortOrder"/> es la portada.</summary>
public class ProductImage
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    /// <summary>Nombre dentro del contenedor, por ejemplo <c>products/12/3f2a….webp</c>; con él se borra.</summary>
    public string BlobName { get; set; } = null!;
    public string Url { get; set; } = null!;
    public string? AltText { get; set; }
    /// <summary>Desde 0 y sin huecos: se renumera al borrar o reordenar.</summary>
    public int SortOrder { get; set; }

    public Product Product { get; set; } = null!;
}
