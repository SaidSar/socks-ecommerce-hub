using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;

namespace Sokko.Api.Data.Configurations;

/// <summary>
/// Fotos de producto. El archivo vive en el almacenamiento de imágenes; aquí solo su nombre y su URL pública.
/// Sin cascada (D-07): los productos solo se dan de baja lógica, y una foto se borra junto con su archivo.
/// </summary>
public class ProductImageConfiguration : IEntityTypeConfiguration<ProductImage>
{
    public void Configure(EntityTypeBuilder<ProductImage> b)
    {
        b.ToTable("ProductImages", t => t.HasCheckConstraint("CK_ProductImages_SortOrder", "[SortOrder] >= 0"));

        b.Property(i => i.BlobName).HasAsciiColumn(200);
        b.Property(i => i.Url).HasMaxLength(500);
        b.Property(i => i.AltText).HasMaxLength(200);

        b.HasIndex(i => i.BlobName).IsUnique().HasDatabaseName("UQ_ProductImages_BlobName");
        b.HasIndex(i => new { i.ProductId, i.SortOrder }).HasDatabaseName("IX_ProductImages_ProductId_SortOrder");

        b.HasOne(i => i.Product).WithMany(p => p.Images)
            .HasForeignKey(i => i.ProductId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_ProductImages_Products");
    }
}
