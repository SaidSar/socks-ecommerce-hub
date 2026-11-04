using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.ModelBuilderExtensions;

namespace Sokko.Api.Data.Configurations;

/// <summary>DESIGN_DB §3.13a y D-40.</summary>
public class CouponConfiguration : IEntityTypeConfiguration<Coupon>
{
    public void Configure(EntityTypeBuilder<Coupon> b)
    {
        b.ToTable("Coupons", t =>
        {
            t.HasCheckConstraint("CK_Coupons_Code", $"LEN([Code]) BETWEEN 3 AND 30 AND [Code] COLLATE {BinaryCollation} NOT LIKE '%[^A-Z0-9-]%'");
            t.HasCheckConstraint("CK_Coupons_Type", SqlIn<CouponType>("Type"));
            t.HasCheckConstraint("CK_Coupons_Value",
                "([Type] = 'Percent' AND [Value] BETWEEN 1 AND 90) OR ([Type] = 'Fixed' AND [Value] > 0) OR ([Type] = 'FreeShipping' AND [Value] = 0)");
            t.HasCheckConstraint("CK_Coupons_MinSubtotal", "[MinSubtotal] IS NULL OR [MinSubtotal] > 0");
            t.HasCheckConstraint("CK_Coupons_Dates", "[StartsOn] IS NULL OR [EndsOn] IS NULL OR [EndsOn] >= [StartsOn]");
            t.HasCheckConstraint("CK_Coupons_MaxRedemptions", "[MaxRedemptions] IS NULL OR [MaxRedemptions] >= 1");
        });

        b.Property(c => c.Code).HasAsciiColumn(30);
        b.Property(c => c.Description).HasMaxLength(200);
        b.Property(c => c.Type).HasEnumColumn(12);
        b.Property(c => c.OnePerCustomer).HasDbDefault(false);
        b.Property(c => c.IsActive).HasDbDefault(true);
        b.Property(c => c.CreatedAt).HasUtcNowDefault();
        b.Property(c => c.UpdatedAt).HasUtcNowDefault();
        b.Property(c => c.RowVersion).IsRowVersion();

        b.HasIndex(c => c.Code).IsUnique().HasDatabaseName("UQ_Coupons_Code");
    }
}

/// <summary>DESIGN_DB §3.13b: un uso por pedido; FK sin cascada (D-07).</summary>
public class CouponRedemptionConfiguration : IEntityTypeConfiguration<CouponRedemption>
{
    public void Configure(EntityTypeBuilder<CouponRedemption> b)
    {
        b.ToTable("CouponRedemptions", t =>
            t.HasCheckConstraint("CK_CouponRedemptions_DiscountAmount", "[DiscountAmount] >= 0"));

        b.Property(r => r.CustomerEmail).HasMaxLength(254);
        b.Property(r => r.CreatedAt).HasUtcNowDefault();

        b.HasIndex(r => r.OrderId).IsUnique().HasDatabaseName("UQ_CouponRedemptions_OrderId");
        b.HasIndex(r => new { r.CouponId, r.CustomerEmail }).HasDatabaseName("IX_CouponRedemptions_CouponId_CustomerEmail");

        b.HasOne(r => r.Coupon).WithMany(c => c.Redemptions)
            .HasForeignKey(r => r.CouponId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_CouponRedemptions_Coupons");

        b.HasOne(r => r.Order).WithMany()
            .HasForeignKey(r => r.OrderId)
            .OnDelete(DeleteBehavior.NoAction)
            .HasConstraintName("FK_CouponRedemptions_Orders");
    }
}
