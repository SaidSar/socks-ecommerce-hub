using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.5c y semilla §5.3. Ventana anual recurrente (D-36).</summary>
public class CollectionConfiguration : IEntityTypeConfiguration<Collection>
{
    public void Configure(EntityTypeBuilder<Collection> b)
    {
        b.ToTable("Collections", t =>
        {
            t.HasCheckConstraint("CK_Collections_Slug", SqlSlug("Slug"));
            t.HasCheckConstraint("CK_Collections_Kind", SqlIn<CollectionKind>("Kind"));
            t.HasCheckConstraint("CK_Collections_StartMonth", "[StartMonth] IS NULL OR [StartMonth] BETWEEN 1 AND 12");
            t.HasCheckConstraint("CK_Collections_EndMonth", "[EndMonth] IS NULL OR [EndMonth] BETWEEN 1 AND 12");
            t.HasCheckConstraint("CK_Collections_StartDay", ValidDay("StartMonth", "StartDay"));
            t.HasCheckConstraint("CK_Collections_EndDay", ValidDay("EndMonth", "EndDay"));
            t.HasCheckConstraint("CK_Collections_Window",
                "([Kind] = 'Tematica' AND [StartMonth] IS NULL AND [StartDay] IS NULL AND [EndMonth] IS NULL AND [EndDay] IS NULL)"
                + " OR ([Kind] = 'Temporada' AND [StartMonth] IS NOT NULL AND [StartDay] IS NOT NULL AND [EndMonth] IS NOT NULL AND [EndDay] IS NOT NULL)");
            t.HasCheckConstraint("CK_Collections_Discount", "[OffSeasonDiscountPct] >= 0 AND [OffSeasonDiscountPct] < 1");
        });

        b.Property(x => x.RowVersion).IsRowVersion();
        b.Property(x => x.Name).HasMaxLength(80);
        b.Property(x => x.Slug).HasAsciiColumn(80);
        b.Property(x => x.Kind).HasEnumColumn(10);
        b.Property(x => x.StartKey).HasComputedColumnSql("[StartMonth] * 100 + [StartDay]", stored: true);
        b.Property(x => x.EndKey).HasComputedColumnSql("[EndMonth] * 100 + [EndDay]", stored: true);
        b.Property(x => x.OffSeasonDiscountPct).HasPrecision(5, 4).HasDbDefault(0.30m);
        b.Property(x => x.IsActive).HasDbDefault(true);
        b.Property(x => x.CreatedAt).HasUtcNowDefault();
        b.Property(x => x.UpdatedAt).HasUtcNowDefault();

        b.HasIndex(x => x.Slug).IsUnique().HasDatabaseName("UQ_Collections_Slug");
        b.HasIndex(x => x.Name).IsUnique().HasDatabaseName("UQ_Collections_Name");
        // Colecciones en temporada para el menú y R-28.
        b.HasIndex(x => new { x.Kind, x.StartKey, x.EndKey })
            .HasDatabaseName("IX_Collections_Kind_Window")
            .IncludeProperties(x => x.OffSeasonDiscountPct)
            .HasFilter("[IsActive] = 1");

        b.HasData(Seed.CatalogSeed.Collections);
    }

    /// <summary>Día válido para el mes; sin 29 de febrero, para que la ventana exista todos los años.</summary>
    private static string ValidDay(string month, string day) =>
        $"[{day}] IS NULL OR ([{day}] >= 1 AND (([{month}] IN (1, 3, 5, 7, 8, 10, 12) AND [{day}] <= 31)"
        + $" OR ([{month}] IN (4, 6, 9, 11) AND [{day}] <= 30) OR ([{month}] = 2 AND [{day}] <= 28)))";
}
