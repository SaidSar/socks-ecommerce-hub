using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.5b y semilla §5.3.</summary>
public class ProductTypeConfiguration : IEntityTypeConfiguration<ProductType>
{
    public void Configure(EntityTypeBuilder<ProductType> b)
    {
        b.ToTable("ProductTypes", t =>
        {
            t.HasCheckConstraint("CK_ProductTypes_Code", SqlSlug("Code"));
            t.HasCheckConstraint("CK_ProductTypes_SizeSystem", SqlIn<SizeSystem>("SizeSystem"));
            t.HasCheckConstraint("CK_ProductTypes_UnitLabel", SqlIn<UnitLabel>("UnitLabel"));
        });

        b.Property(x => x.Code).HasAsciiColumn(20);
        b.Property(x => x.Name).HasMaxLength(40);
        b.Property(x => x.SizeSystem).HasEnumColumn(10);
        b.Property(x => x.UnitLabel).HasEnumColumn(6).HasDbDefault(UnitLabel.Pieza);
        b.Property(x => x.SortOrder).HasDbDefault((byte)0);
        b.Property(x => x.IsActive).HasDbDefault(true);

        b.HasIndex(x => x.Code).IsUnique().HasDatabaseName("UQ_ProductTypes_Code");
        b.HasIndex(x => x.Name).IsUnique().HasDatabaseName("UQ_ProductTypes_Name");

        b.HasData(Seed.CatalogSeed.ProductTypes);
    }
}
