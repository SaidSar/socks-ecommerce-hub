using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.10. Incluye el hito <c>Pagado</c>.</summary>
public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> b)
    {
        b.ToTable("OrderStatusHistory", t =>
            t.HasCheckConstraint("CK_OrderStatusHistory_Status", SqlIn<OrderStatus>("Status")));

        b.Property(h => h.Status).HasEnumColumn(15);
        b.Property(h => h.ChangedAt).HasUtcNowDefault();
        b.Property(h => h.ChangedByName).HasMaxLength(80);
        b.Property(h => h.Note).HasMaxLength(250);

        b.HasIndex(h => new { h.OrderId, h.ChangedAt }).HasDatabaseName("IX_OrderStatusHistory_OrderId_ChangedAt");
        b.HasIndex(h => h.ChangedByUserId).HasDatabaseName("IX_OrderStatusHistory_ChangedByUserId");

        b.HasOne(h => h.Order).WithMany(o => o.StatusHistory)
            .HasForeignKey(h => h.OrderId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_OrderStatusHistory_Orders");
        b.HasOne(h => h.ChangedByUser).WithMany()
            .HasForeignKey(h => h.ChangedByUserId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_OrderStatusHistory_Users");
    }
}
