using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.12 y semilla §5.5. Fila única tipada (D-16).</summary>
public class SettingConfiguration : IEntityTypeConfiguration<Setting>
{
    public void Configure(EntityTypeBuilder<Setting> b)
    {
        b.ToTable("Settings", t =>
        {
            t.HasCheckConstraint("CK_Settings_Singleton", $"[Id] = {Setting.SingletonId}");
            t.HasCheckConstraint("CK_Settings_FreeShippingThreshold", "[FreeShippingThreshold] > 0");
            t.HasCheckConstraint("CK_Settings_ParcelShippingCost", "[ParcelShippingCost] >= 0");
            t.HasCheckConstraint("CK_Settings_LocalShippingCost", "[LocalShippingCost] >= 0");
            t.HasCheckConstraint("CK_Settings_FewUnitsThreshold", "[FewUnitsThreshold] >= 0");
            t.HasCheckConstraint("CK_Settings_IvaRate", "[IvaRate] BETWEEN 0 AND 1");
        });

        b.Property(s => s.Id).ValueGeneratedNever();
        b.Property(s => s.LocalFreeShipping).HasDbDefault(true);
        b.Property(s => s.IvaRate).HasPrecision(5, 4);
        b.Property(s => s.UpdatedAt).HasUtcNowDefault();
        b.Property(s => s.RowVersion).IsRowVersion();

        b.HasIndex(s => s.FeaturedProductId).HasDatabaseName("IX_Settings_FeaturedProductId");
        b.HasIndex(s => s.UpdatedByUserId).HasDatabaseName("IX_Settings_UpdatedByUserId");

        b.HasOne(s => s.FeaturedProduct).WithMany()
            .HasForeignKey(s => s.FeaturedProductId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Settings_Products");
        b.HasOne(s => s.UpdatedByUser).WithMany()
            .HasForeignKey(s => s.UpdatedByUserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Settings_Users");

        b.HasData(Seed.CatalogSeed.Settings);
    }
}
