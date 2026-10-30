using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.8.</summary>
public class OrderConfiguration : IEntityTypeConfiguration<Order>
{
    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders", t =>
        {
            t.HasCheckConstraint("CK_Orders_FolioNumber", "[FolioNumber] >= 1000");
            t.HasCheckConstraint("CK_Orders_PostalCode", SqlPostalCode("ShipPostalCode"));
            t.HasCheckConstraint("CK_Orders_DeliveryMethod", SqlIn<DeliveryMethod>("DeliveryMethod"));
            // "Pagado" es solo hito del historial, no estado del pedido.
            t.HasCheckConstraint("CK_Orders_Status", SqlIn("Status",
                OrderStatus.PorPreparar, OrderStatus.Preparando, OrderStatus.Enviado,
                OrderStatus.EnRuta, OrderStatus.Entregado, OrderStatus.Cancelado));
            t.HasCheckConstraint("CK_Orders_PaymentMethod", SqlIn<PaymentMethod>("PaymentMethod"));
            t.HasCheckConstraint("CK_Orders_PaymentStatus", SqlIn<PaymentStatus>("PaymentStatus"));
            t.HasCheckConstraint("CK_Orders_PaidAt", "[PaymentStatus] = 'Pendiente' OR [PaidAt] IS NOT NULL");
            t.HasCheckConstraint("CK_Orders_Subtotal", "[Subtotal] >= 0");
            t.HasCheckConstraint("CK_Orders_ShippingCost", "[ShippingCost] >= 0");
            t.HasCheckConstraint("CK_Orders_Total", "[Total] = [Subtotal] + [ShippingCost]");
            t.HasCheckConstraint("CK_Orders_TaxRate", "[TaxRate] BETWEEN 0 AND 1");
            t.HasCheckConstraint("CK_Orders_StatusMatchesDelivery",
                "NOT ([Status] = 'Enviado' AND [DeliveryMethod] = 'Local') AND NOT ([Status] = 'EnRuta' AND [DeliveryMethod] = 'Paqueteria')");
            // Un pedido OXXO sin pagar no se surte (D-15).
            t.HasCheckConstraint("CK_Orders_PaymentBeforeFulfillment",
                "[PaymentStatus] = 'Pagado' OR [Status] IN ('PorPreparar', 'Cancelado')");
        });

        b.Property(o => o.FolioNumber)
            .HasDefaultValueSql($"NEXT VALUE FOR [dbo].[{SokkoDbContext.OrderFolioSequence}]");
        b.Property(o => o.Folio)
            .HasAsciiColumn(14)
            .HasComputedColumnSql("'SKK-' + CAST([FolioNumber] AS VARCHAR(10))", stored: true);
        b.Property(o => o.CustomerFirstName).HasMaxLength(80);
        b.Property(o => o.CustomerLastName).HasMaxLength(80);
        b.Property(o => o.CustomerEmail).HasMaxLength(254);
        b.Property(o => o.CustomerPhone).HasAsciiColumn(15);
        b.Property(o => o.ShipStreet).HasMaxLength(150);
        b.Property(o => o.ShipNeighborhood).HasMaxLength(100);
        b.Property(o => o.ShipCity).HasMaxLength(80);
        b.Property(o => o.ShipState).HasMaxLength(40);
        b.Property(o => o.ShipPostalCode).HasAsciiColumn(5, fixedLength: true);
        b.Property(o => o.ShipReferences).HasMaxLength(250);
        b.Property(o => o.DeliveryMethod).HasEnumColumn(12);
        b.Property(o => o.Status).HasEnumColumn(15).HasDbDefault(OrderStatus.PorPreparar);
        b.Property(o => o.PaymentMethod).HasEnumColumn(10);
        b.Property(o => o.PaymentStatus).HasEnumColumn(12).HasDbDefault(PaymentStatus.Pendiente);
        b.Property(o => o.PaymentReference).HasMaxLength(100);
        b.Property(o => o.TaxRate).HasPrecision(5, 4);
        b.Property(o => o.TaxIncluded)
            .HasComputedColumnSql("CAST(ROUND([Total] - [Total] / (1 + [TaxRate]), 2) AS DECIMAL(10, 2))", stored: true);
        b.Property(o => o.GiftWrap).HasDbDefault(true);
        b.Property(o => o.InternalNote).HasMaxLength(500);
        b.Property(o => o.CreatedAt).HasUtcNowDefault();
        b.Property(o => o.UpdatedAt).HasUtcNowDefault();
        b.Property(o => o.RowVersion).IsRowVersion();

        b.HasIndex(o => o.FolioNumber).IsUnique().HasDatabaseName("UQ_Orders_FolioNumber");
        b.HasIndex(o => o.Folio).IsUnique().HasDatabaseName("UQ_Orders_Folio");
        b.HasIndex(o => new { o.Status, o.CreatedAt })
            .HasDatabaseName("IX_Orders_Status_CreatedAt")
            .IncludeProperties(o => new { o.DeliveryMethod, o.PaymentMethod, o.PaymentStatus, o.Total });
        b.HasIndex(o => o.CreatedAt)
            .HasDatabaseName("IX_Orders_CreatedAt")
            .IncludeProperties(o => new { o.Status, o.Total, o.ShippingCost, o.Subtotal });
        b.HasIndex(o => o.CreatedAt, "IX_Orders_PendingPayment")
            .HasFilter("[PaymentStatus] = 'Pendiente'")
            .IncludeProperties(o => new { o.PaymentMethod, o.Status });
        b.HasIndex(o => new { o.UserId, o.CreatedAt })
            .HasDatabaseName("IX_Orders_UserId_CreatedAt")
            .HasFilter("[UserId] IS NOT NULL");
        b.HasIndex(o => o.CustomerEmail).HasDatabaseName("IX_Orders_CustomerEmail");

        b.HasOne(o => o.User).WithMany(u => u.Orders)
            .HasForeignKey(o => o.UserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_Orders_Users");
    }
}
