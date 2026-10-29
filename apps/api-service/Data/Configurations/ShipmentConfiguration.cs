using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.11. FK simple a <c>Orders</c>, sin llave alterna (D-13).</summary>
public class ShipmentConfiguration : IEntityTypeConfiguration<Shipment>
{
    public void Configure(EntityTypeBuilder<Shipment> b)
    {
        b.ToTable("Shipments", t =>
        {
            t.HasCheckConstraint("CK_Shipments_DeliveryMethod", SqlIn<DeliveryMethod>("DeliveryMethod"));
            t.HasCheckConstraint("CK_Shipments_Carrier", $"[Carrier] IS NULL OR {SqlIn<Carrier>("Carrier")}");
            // Equivale a ^\d{10,}$.
            t.HasCheckConstraint("CK_Shipments_Tracking",
                "[TrackingNumber] IS NULL OR (LEN([TrackingNumber]) >= 10 AND [TrackingNumber] NOT LIKE '%[^0-9]%')");
            t.HasCheckConstraint("CK_Shipments_DeliveredAt", "[DeliveredAt] IS NULL OR [DeliveredAt] >= [ShippedAt]");
            t.HasCheckConstraint("CK_Shipments_ByMethod",
                "([DeliveryMethod] = 'Paqueteria' AND [Carrier] IS NOT NULL AND [TrackingNumber] IS NOT NULL AND [CourierUserId] IS NULL AND [CourierName] IS NULL)"
                + " OR ([DeliveryMethod] = 'Local' AND ([CourierUserId] IS NOT NULL OR [CourierName] IS NOT NULL) AND [Carrier] IS NULL AND [TrackingNumber] IS NULL)");
        });

        b.Property(s => s.DeliveryMethod).HasEnumColumn(12);
        b.Property(s => s.Carrier).HasEnumColumn(20);
        b.Property(s => s.TrackingNumber).HasMaxLength(30).IsUnicode(false);
        b.Property(s => s.CourierName).HasMaxLength(80);
        b.Property(s => s.ShippedAt).HasUtcNowDefault();

        b.HasIndex(s => s.OrderId).IsUnique().HasDatabaseName("UQ_Shipments_OrderId");
        b.HasIndex(s => s.TrackingNumber).HasDatabaseName("IX_Shipments_TrackingNumber").HasFilter("[TrackingNumber] IS NOT NULL");
        b.HasIndex(s => s.CourierUserId).HasDatabaseName("IX_Shipments_CourierUserId").HasFilter("[CourierUserId] IS NOT NULL");

        b.HasOne(s => s.Order).WithOne(o => o.Shipment)
            .HasForeignKey<Shipment>(s => s.OrderId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Shipments_Orders");
        b.HasOne(s => s.CourierUser).WithMany()
            .HasForeignKey(s => s.CourierUserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Shipments_Users");
    }
}
