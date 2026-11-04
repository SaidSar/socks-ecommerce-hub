using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Reglas puras de los cupones y la cotización común (D-40), sin BD.</summary>
public class CouponRulesTests
{
    private static readonly DateOnly Today = new(2026, 11, 15);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Coupon Percent(decimal value) => new() { Code = "DIEZ", Type = CouponType.Percent, Value = value, IsActive = true };

    [Theory]
    [InlineData(" bienvenida 10 ", "BIENVENIDA10")]
    [InlineData("envío", "ENVÍO")]
    [InlineData("   ", null)]
    [InlineData(null, null)]
    public void Codes_are_uppercased_without_spaces(string? input, string? expected) =>
        Assert.Equal(expected, CouponRules.Normalize(input));

    [Theory]
    [InlineData("AB", false)]
    [InlineData("ABC", true)]
    [InlineData("BLACK-FRIDAY-2026", true)]
    [InlineData("ENVÍO", false)]
    [InlineData("1234567890123456789012345678901", false)]
    public void Code_pattern_is_3_to_30_ascii_letters_digits_or_dashes(string code, bool valid) =>
        Assert.Equal(valid, CouponRules.IsValidCode(code));

    [Theory]
    [InlineData(10, 559, 55.90)]
    [InlineData(15, 333.30, 50.00)] // 49.995 → 50.00, AwayFromZero
    [InlineData(90, 100, 90)]
    public void Percent_discount_is_rounded_to_cents_away_from_zero(decimal pct, decimal subtotal, decimal discount) =>
        Assert.Equal(discount, CouponRules.DiscountFor(Percent(pct), subtotal));

    [Theory]
    [InlineData(100, 559, 100)]
    [InlineData(1000, 400, 400)]
    public void Fixed_discount_never_exceeds_the_subtotal(decimal value, decimal subtotal, decimal discount) =>
        Assert.Equal(discount, CouponRules.DiscountFor(new Coupon { Type = CouponType.Fixed, Value = value }, subtotal));

    [Fact]
    public void Free_shipping_and_no_coupon_discount_nothing()
    {
        Assert.Equal(0m, CouponRules.DiscountFor(new Coupon { Type = CouponType.FreeShipping }, 500m));
        Assert.Equal(0m, CouponRules.DiscountFor(null, 500m));
    }

    public static TheoryData<Coupon, int, bool?, decimal, string> Rejections => new()
    {
        { new Coupon { Code = "A", IsActive = false }, 0, null, 500m, CouponRules.Inactive },
        { new Coupon { Code = "A", IsActive = true, StartsOn = new DateOnly(2026, 11, 20) }, 0, null, 500m, CouponRules.NotStarted },
        { new Coupon { Code = "A", IsActive = true, EndsOn = new DateOnly(2026, 11, 14) }, 0, null, 500m, CouponRules.Expired },
        { new Coupon { Code = "A", IsActive = true, MaxRedemptions = 50 }, 50, null, 500m, CouponRules.Exhausted },
        { new Coupon { Code = "A", IsActive = true, OnePerCustomer = true }, 1, true, 500m, CouponRules.AlreadyUsed },
        { new Coupon { Code = "A", IsActive = true, MinSubtotal = 500m }, 0, null, 499.99m, CouponRules.MinSubtotal },
    };

    [Theory]
    [MemberData(nameof(Rejections))]
    public void Every_rejection_has_its_reason(Coupon coupon, int redemptions, bool? usedByEmail, decimal subtotal, string reason) =>
        Assert.Equal(reason, CouponRules.Check(coupon, Today, subtotal, redemptions, usedByEmail)?.Reason);

    [Fact]
    public void Rejection_messages_are_clear_and_in_spanish()
    {
        Assert.Equal("Este código no existe.", CouponRules.NotFoundRejection.Message);
        Assert.Equal("Este código es válido a partir del 10 de noviembre.",
            CouponRules.Check(new Coupon { IsActive = true, StartsOn = new DateOnly(2026, 11, 10) }, new DateOnly(2026, 11, 1), 1m, 0, null)!.Message);
        Assert.Equal("Este código venció el 30 de noviembre.",
            CouponRules.Check(new Coupon { IsActive = true, EndsOn = new DateOnly(2026, 11, 30) }, new DateOnly(2026, 12, 1), 1m, 0, null)!.Message);
        Assert.Equal("Este código aplica en compras desde $500.",
            CouponRules.Check(new Coupon { IsActive = true, MinSubtotal = 500m }, Today, 100m, 0, null)!.Message);
        Assert.Equal("Este código ya se agotó.",
            CouponRules.Check(new Coupon { IsActive = true, MaxRedemptions = 1 }, Today, 1m, 1, null)!.Message);
        Assert.Equal("Este código ya se usó con su correo.",
            CouponRules.Check(new Coupon { IsActive = true, OnePerCustomer = true }, Today, 1m, 1, true)!.Message);
    }

    [Fact]
    public void Validity_dates_are_inclusive_local_days()
    {
        var coupon = new Coupon { IsActive = true, StartsOn = new DateOnly(2026, 11, 10), EndsOn = new DateOnly(2026, 11, 30) };

        Assert.Null(CouponRules.Check(coupon, new DateOnly(2026, 11, 10), 1m, 0, null));
        Assert.Null(CouponRules.Check(coupon, new DateOnly(2026, 11, 30), 1m, 0, null));

        // 23:30 del 30 de noviembre en Los Mochis ya es 1 de diciembre en UTC: el cupón todavía vale.
        var lateNight = new DateTime(2026, 12, 1, 6, 30, 0, DateTimeKind.Utc);
        Assert.Equal(new DateOnly(2026, 11, 30), BusinessTime.DateOf(lateNight));
        Assert.Null(CouponRules.Check(coupon, BusinessTime.DateOf(lateNight), 1m, 0, null));
        Assert.Equal(CouponRules.Expired, CouponRules.Check(coupon, BusinessTime.DateOf(lateNight.AddHours(1)), 1m, 0, null)!.Reason);
    }

    [Fact]
    public void Unknown_email_does_not_block_one_per_customer_in_the_preview()
    {
        var coupon = new Coupon { IsActive = true, OnePerCustomer = true };
        Assert.Null(CouponRules.Check(coupon, Today, 1m, 3, usedByEmail: null));
    }

    [Theory]
    [InlineData(true, null, null, 0, "inactive")]
    [InlineData(false, null, "2026-11-14", 0, "expired")]
    [InlineData(false, 5, null, 5, "exhausted")]
    [InlineData(false, null, null, 0, "active")]
    public void Panel_status_of_a_coupon(bool inactive, int? max, string? endsOn, int uses, string status)
    {
        var coupon = new Coupon { IsActive = !inactive, MaxRedemptions = max, EndsOn = endsOn is null ? null : DateOnly.Parse(endsOn) };
        Assert.Equal(status, CouponRules.StatusOf(coupon, Today, uses));
    }

    [Fact]
    public void Scheduled_coupon_starts_in_the_future()
    {
        Assert.Equal("scheduled", CouponRules.StatusOf(new Coupon { IsActive = true, StartsOn = Today.AddDays(1) }, Today, 0));
    }

    [Fact]
    public void Public_description_never_includes_the_internal_note()
    {
        Assert.Equal("10% de descuento", CouponRules.PublicDescription(new Coupon { Type = CouponType.Percent, Value = 10, Description = "Campaña interna" }));
        Assert.Equal("$100 de descuento", CouponRules.PublicDescription(new Coupon { Type = CouponType.Fixed, Value = 100 }));
        Assert.Equal("Envío gratis", CouponRules.PublicDescription(new Coupon { Type = CouponType.FreeShipping }));
    }

    // --- Cotización común ---

    private static QuoteOrder Quote()
    {
        var settings = new FakeSettingsService(new ConfigDto(799m, 99m, 49m, true, 4, 0.16m), "81250");
        return new QuoteOrder(new QuoteShipping(settings), settings);
    }

    [Fact]
    public async Task Quote_reports_what_is_missing_for_courtesy_shipping_after_the_discount()
    {
        var quote = await Quote().QuoteAsync(800m, "06700", Percent(10), Ct);

        Assert.Equal(80m, quote.Discount);
        Assert.Equal(99m, quote.ShippingCost);
        Assert.Equal(819m, quote.Total);
        Assert.Equal(79m, quote.FreeShippingRemaining);
    }

    [Fact]
    public async Task Quote_without_postal_code_has_no_shipping_yet()
    {
        var quote = await Quote().QuoteAsync(500m, null, Percent(10), Ct);

        Assert.Null(quote.ShippingCost);
        Assert.Equal(450m, quote.Total);
        Assert.Equal(349m, quote.FreeShippingRemaining);
    }

    [Fact]
    public async Task Free_shipping_coupon_has_nothing_missing()
    {
        var quote = await Quote().QuoteAsync(100m, "81250", new Coupon { Type = CouponType.FreeShipping }, Ct);

        Assert.Equal(DeliveryMethod.Local, quote.Method);
        Assert.Equal(0m, quote.ShippingCost);
        Assert.Null(quote.FreeShippingRemaining);
    }

    [Fact]
    public void Admin_validation_messages_per_field()
    {
        var errors = CouponService.Validate(new AdminCouponRequestDto { Type = CouponType.Percent, Value = 95, MinSubtotal = 0, MaxRedemptions = 0, StartsOn = Today, EndsOn = Today.AddDays(-1) }, "X");

        Assert.Equal(["code", "endsOn", "maxRedemptions", "minSubtotal", "value"], errors.Keys.Order());
        Assert.Empty(CouponService.Validate(new AdminCouponRequestDto { Type = CouponType.FreeShipping }, "ENVIOGRATIS"));
    }
}
