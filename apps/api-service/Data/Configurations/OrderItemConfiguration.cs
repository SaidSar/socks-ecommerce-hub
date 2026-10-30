using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.9.</summary>
public class OrderItemConfiguration : IEntityTypeConfiguration<OrderItem>
{
    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("OrderItems", t =>
        {
            t.HasCheckConstraint("CK_OrderItems_Quantity", "[Quantity] > 0");
            t.HasCheckConstraint("CK_OrderItems_UnitPrice", "[UnitPrice] >= 0");
        });

        b.Property(i => i.SkuSnapshot).HasAsciiColumn(20);
        b.Property(i => i.ProductNameSnapshot).HasMaxLength(120);
        b.Property(i => i.ToneNameSnapshot).HasMaxLength(40);
        b.Property(i => i.SizeCodeSnapshot).HasAsciiColumn(3);
        b.Property(i => i.LineTotal).HasComputedColumnSql("CAST([Quantity] * [UnitPrice] AS DECIMAL(10, 2))", stored: true);

        b.HasIndex(i => new { i.OrderId, i.VariantId }).IsUnique().HasDatabaseName("UQ_OrderItems_Order_Variant");
        b.HasIndex(i => i.VariantId).HasDatabaseName("IX_OrderItems_VariantId");

        b.HasOne(i => i.Order).WithMany(o => o.Items)
            .HasForeignKey(i => i.OrderId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_OrderItems_Orders");
        b.HasOne(i => i.Variant).WithMany()
            .HasForeignKey(i => i.VariantId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_OrderItems_ProductVariants");
    }
}
