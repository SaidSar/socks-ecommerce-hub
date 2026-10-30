using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.4 y semilla §5.2.</summary>
public class SizeConfiguration : IEntityTypeConfiguration<Size>
{
    public void Configure(EntityTypeBuilder<Size> b)
    {
        b.ToTable("Sizes", t =>
        {
            t.HasCheckConstraint("CK_Sizes_SizeSystem", SqlIn<SizeSystem>("SizeSystem"));
            t.HasCheckConstraint("CK_Sizes_Code", $"[Code] COLLATE {BinaryCollation} NOT LIKE '%[^A-Z0-9]%'");
        });

        b.Property(s => s.SizeSystem).HasEnumColumn(10);
        b.Property(s => s.Code).HasAsciiColumn(3);
        b.Property(s => s.Label).HasMaxLength(20);
        b.Property(s => s.SortOrder).HasDbDefault((byte)0);
        b.Property(s => s.IsActive).HasDbDefault(true);

        b.HasIndex(s => new { s.SizeSystem, s.Code }).IsUnique().HasDatabaseName("UQ_Sizes_System_Code");
        b.HasIndex(s => new { s.SizeSystem, s.SortOrder }).IsUnique().HasDatabaseName("UQ_Sizes_System_SortOrder");

        b.HasData(Seed.CatalogSeed.Sizes);
    }
}
