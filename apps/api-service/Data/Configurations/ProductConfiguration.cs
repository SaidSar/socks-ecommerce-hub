using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.5. Los productos se siembran solo en Development (§5.4).</summary>
public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> b)
    {
        b.ToTable("Products", t =>
        {
            t.HasCheckConstraint("CK_Products_Line", SqlIn<ProductLine>("Line"));
            t.HasCheckConstraint("CK_Products_PieceNumber", "[PieceNumber] BETWEEN 1 AND 999");
            t.HasCheckConstraint("CK_Products_Slug", SqlSlug("Slug"));
            t.HasCheckConstraint("CK_Products_CollectionRequired", "[Line] <> 'Especiales' OR [CollectionId] IS NOT NULL");
            t.HasCheckConstraint("CK_Products_NameJp", "[Line] <> 'Sokko' OR [NameJp] IS NOT NULL");
            t.HasCheckConstraint("CK_Products_Price", "[Price] > 0");
            t.HasCheckConstraint("CK_Products_UnitsPerPack", "[UnitsPerPack] BETWEEN 1 AND 24");
            t.HasCheckConstraint("CK_Products_EditionSize", "[EditionSize] IS NULL OR [EditionSize] > 0");
        });

        b.Property(p => p.Line).HasEnumColumn(12);
        b.Property(p => p.Slug).HasAsciiColumn(120);
        b.Property(p => p.Name).HasMaxLength(120);
        b.Property(p => p.NameJp).HasMaxLength(60);
        b.Property(p => p.Material).HasMaxLength(200);
        b.Property(p => p.UnitsPerPack).HasDbDefault((byte)1);
        b.Property(p => p.ImageUrl).HasMaxLength(500);
        b.Property(p => p.IsActive).HasDbDefault(true);
        b.Property(p => p.CreatedAt).HasUtcNowDefault();
        b.Property(p => p.UpdatedAt).HasUtcNowDefault();
        b.Property(p => p.RowVersion).IsRowVersion();

        b.HasIndex(p => new { p.Line, p.PieceNumber }).IsUnique().HasDatabaseName("UQ_Products_Line_PieceNumber");
        b.HasIndex(p => p.Slug).IsUnique().HasDatabaseName("UQ_Products_Slug");
        b.HasIndex(p => new { p.Line, p.IsActive })
            .HasDatabaseName("IX_Products_Line_IsActive")
            .IncludeProperties(p => new { p.BrandId, p.ProductTypeId, p.CollectionId, p.Price });
        b.HasIndex(p => p.BrandId).HasDatabaseName("IX_Products_BrandId");
        b.HasIndex(p => p.ProductTypeId).HasDatabaseName("IX_Products_ProductTypeId");
        b.HasIndex(p => p.CollectionId).HasDatabaseName("IX_Products_CollectionId").HasFilter("[CollectionId] IS NOT NULL");

        b.HasOne(p => p.Brand).WithMany(x => x.Products)
            .HasForeignKey(p => p.BrandId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Products_Brands");
        b.HasOne(p => p.ProductType).WithMany(x => x.Products)
            .HasForeignKey(p => p.ProductTypeId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Products_ProductTypes");
        b.HasOne(p => p.Collection).WithMany(x => x.Products)
            .HasForeignKey(p => p.CollectionId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Products_Collections");
    }
}
