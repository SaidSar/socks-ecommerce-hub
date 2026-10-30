using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.6. R-32 (talla del sistema del tipo) lo valida el servicio, no la BD (D-34).</summary>
public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> b)
    {
        const string sku = $"[Sku] COLLATE {BinaryCollation} LIKE '[A-Z][A-Z][A-Z]-[0-9][0-9][0-9]-[A-Z][A-Z][A-Z]-";
        b.ToTable("ProductVariants", t =>
        {
            t.HasCheckConstraint("CK_ProductVariants_Stock", "[Stock] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_Reserved", "[Reserved] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_ReservedLeStock", "[Reserved] <= [Stock]");
            t.HasCheckConstraint("CK_ProductVariants_UnitCost", "[UnitCost] IS NULL OR [UnitCost] >= 0");
            t.HasCheckConstraint("CK_ProductVariants_Barcode",
                $"[Barcode] IS NULL OR [Barcode] COLLATE {BinaryCollation} NOT LIKE '%[^0-9A-Za-z]%'");
            // T-11: 4 prefijos y talla de 1 a 3 caracteres.
            t.HasCheckConstraint("CK_ProductVariants_SkuFormat",
                "LEFT([Sku], 4) IN ('SKK-', 'MRC-', 'ESP-', 'ACC-') AND ("
                + $"{sku}[A-Z0-9]' OR {sku}[A-Z0-9][A-Z0-9]' OR {sku}[A-Z0-9][A-Z0-9][A-Z0-9]')");
        });

        b.Property(v => v.ColorCode).HasAsciiColumn(3, fixedLength: true);
        b.Property(v => v.Sku).HasAsciiColumn(20);
        b.Property(v => v.Barcode).HasMaxLength(32).IsUnicode(false);
        b.Property(v => v.Stock).HasDbDefault(0);
        b.Property(v => v.Reserved).HasDbDefault(0);
        b.Property(v => v.IsActive).HasDbDefault(true);
        b.Property(v => v.RowVersion).IsRowVersion();

        b.HasIndex(v => v.Sku).IsUnique().HasDatabaseName("UQ_ProductVariants_Sku");
        b.HasIndex(v => new { v.ProductId, v.ColorCode, v.SizeId }).IsUnique().HasDatabaseName("UQ_ProductVariants_Product_Color_Size");
        b.HasIndex(v => v.ColorCode).HasDatabaseName("IX_ProductVariants_ColorCode");
        b.HasIndex(v => v.SizeId).HasDatabaseName("IX_ProductVariants_SizeId");
        // Filtrado: un UNIQUE normal solo admite un NULL (D-33).
        b.HasIndex(v => v.Barcode).IsUnique().HasDatabaseName("UQ_ProductVariants_Barcode").HasFilter("[Barcode] IS NOT NULL");

        b.HasOne(v => v.Product).WithMany(p => p.Variants)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_ProductVariants_Products");
        b.HasOne(v => v.Color).WithMany()
            .HasForeignKey(v => v.ColorCode)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_ProductVariants_Colors");
        b.HasOne(v => v.Size).WithMany()
            .HasForeignKey(v => v.SizeId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_ProductVariants_Sizes");
    }
}
