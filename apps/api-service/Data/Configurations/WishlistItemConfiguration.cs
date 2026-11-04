using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;

namespace Sokko.Api.Data.Configurations;

/// <summary>
/// Favoritos de la tienda. Como los tokens de contraseña, se van con el usuario (CASCADE): no tienen valor de auditoría.
/// Un producto con favoritos no se borra (NO ACTION); de todos modos los productos solo se dan de baja lógica.
/// </summary>
public class WishlistItemConfiguration : IEntityTypeConfiguration<WishlistItem>
{
    public void Configure(EntityTypeBuilder<WishlistItem> b)
    {
        b.ToTable("WishlistItems");

        b.HasKey(w => new { w.UserId, w.ProductId }).HasName("PK_WishlistItems");
        b.Property(w => w.CreatedAt).HasUtcNowDefault();

        b.HasIndex(w => w.ProductId).HasDatabaseName("IX_WishlistItems_ProductId");

        b.HasOne(w => w.User).WithMany()
            .HasForeignKey(w => w.UserId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("FK_WishlistItems_Users");

        b.HasOne(w => w.Product).WithMany()
            .HasForeignKey(w => w.ProductId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_WishlistItems_Products");
    }
}
