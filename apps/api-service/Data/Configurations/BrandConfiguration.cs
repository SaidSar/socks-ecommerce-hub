using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.5a y semilla §5.3.</summary>
public class BrandConfiguration : IEntityTypeConfiguration<Brand>
{
    public void Configure(EntityTypeBuilder<Brand> b)
    {
        b.ToTable("Brands", t => t.HasCheckConstraint("CK_Brands_Slug", SqlSlug("Slug")));

        b.Property(x => x.RowVersion).IsRowVersion();
        b.Property(x => x.Name).HasMaxLength(60);
        b.Property(x => x.Slug).HasAsciiColumn(60);
        b.Property(x => x.IsOwnBrand).HasDbDefault(false);
        b.Property(x => x.ShowInFilters).HasDbDefault(true);
        b.Property(x => x.IsActive).HasDbDefault(true);
        b.Property(x => x.CreatedAt).HasUtcNowDefault();

        b.HasIndex(x => x.Name).IsUnique().HasDatabaseName("UQ_Brands_Name");
        b.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("UQ_Brands_Slug");
        // Como máximo una marca propia.
        b.HasIndex(x => x.IsOwnBrand).IsUnique().HasDatabaseName("UQ_Brands_OwnBrand").HasFilter("[IsOwnBrand] = 1");

        b.HasData(Seed.CatalogSeed.Brands);
    }
}
