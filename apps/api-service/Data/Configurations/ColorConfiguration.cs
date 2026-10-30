using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.3 y semilla §5.1.</summary>
public class ColorConfiguration : IEntityTypeConfiguration<Color>
{
    private const string HexPattern = "'#[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'";

    public void Configure(EntityTypeBuilder<Color> b)
    {
        b.ToTable("Colors", t =>
        {
            t.HasCheckConstraint("CK_Colors_Code", $"[Code] COLLATE {BinaryCollation} LIKE '[A-Z][A-Z][A-Z]'");
            t.HasCheckConstraint("CK_Colors_Slug", SqlSlug("Slug"));
            t.HasCheckConstraint("CK_Colors_Hex", $"[Hex] IS NULL OR [Hex] COLLATE {BinaryCollation} LIKE {HexPattern}");
            t.HasCheckConstraint("CK_Colors_LineHex", $"[LineHex] IS NULL OR [LineHex] COLLATE {BinaryCollation} LIKE {HexPattern}");
        });

        b.HasKey(c => c.Code);
        b.Property(c => c.Code).HasAsciiColumn(3, fixedLength: true);
        b.Property(c => c.Slug).HasAsciiColumn(20);
        b.Property(c => c.Name).HasMaxLength(40);
        b.Property(c => c.Hex).HasMaxLength(7).IsUnicode(false).IsFixedLength();
        b.Property(c => c.LineHex).HasMaxLength(7).IsUnicode(false).IsFixedLength();
        b.Property(c => c.IsSokkoTone).HasDbDefault(false);
        b.Property(c => c.SortOrder).HasDbDefault((byte)0);
        b.Property(c => c.IsActive).HasDbDefault(true);

        b.HasIndex(c => c.Slug).IsUnique().HasDatabaseName("UQ_Colors_Slug");
        b.HasIndex(c => c.Name).IsUnique().HasDatabaseName("UQ_Colors_Name");
        b.HasIndex(c => c.IsSokkoTone).HasDatabaseName("IX_Colors_IsSokkoTone");

        b.HasData(Seed.CatalogSeed.Colors);
    }
}
