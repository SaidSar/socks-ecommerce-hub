using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.13 y semilla §5.6. Que dos rangos no se encimen lo valida el servicio.</summary>
public class LocalDeliveryZoneConfiguration : IEntityTypeConfiguration<LocalDeliveryZone>
{
    public void Configure(EntityTypeBuilder<LocalDeliveryZone> b)
    {
        b.ToTable("LocalDeliveryZones", t =>
        {
            t.HasCheckConstraint("CK_LocalDeliveryZones_PostalCodeFrom", SqlPostalCode("PostalCodeFrom"));
            t.HasCheckConstraint("CK_LocalDeliveryZones_PostalCodeTo", SqlPostalCode("PostalCodeTo"));
            // Con CHAR(5) de solo dígitos el orden de texto es igual al numérico.
            t.HasCheckConstraint("CK_LocalDeliveryZones_Range", "[PostalCodeFrom] <= [PostalCodeTo]");
        });

        b.Property(z => z.PostalCodeFrom).HasAsciiColumn(5, fixedLength: true);
        b.Property(z => z.PostalCodeTo).HasAsciiColumn(5, fixedLength: true);
        b.Property(z => z.Label).HasMaxLength(80);
        b.Property(z => z.IsConfirmed).HasDbDefault(true);
        b.Property(z => z.IsActive).HasDbDefault(true);
        b.Property(z => z.CreatedAt).HasUtcNowDefault();

        b.HasIndex(z => new { z.PostalCodeFrom, z.PostalCodeTo }).IsUnique().HasDatabaseName("UQ_LocalDeliveryZones_Range");

        b.HasData(Seed.CatalogSeed.LocalDeliveryZones);
    }
}
