using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>R-14: CP en zona local, umbral de envío gratis y <c>LocalFreeShipping</c>.</summary>
public class QuoteShippingTests
{
    private const string LocalCp = "81250";
    private const string OtherCp = "06700";

    private static Task<ShippingQuoteDto> Quote(string postalCode, decimal subtotal, bool localFreeShipping = true) =>
        new QuoteShipping(new FakeSettingsService(new ConfigDto(799m, 99m, 49m, localFreeShipping, 4, 0.16m), LocalCp))
            .QuoteAsync(postalCode, subtotal, TestContext.Current.CancellationToken);

    [Fact]
    public async Task Local_below_threshold_pays_the_local_rate() =>
        Assert.Equal(new ShippingQuoteDto(DeliveryMethod.Local, 49m), await Quote(LocalCp, 798.99m));

    [Fact]
    public async Task Local_at_threshold_is_free() =>
        Assert.Equal(new ShippingQuoteDto(DeliveryMethod.Local, 0m), await Quote(LocalCp, 799m));

    [Fact]
    public async Task Local_keeps_its_rate_when_local_free_shipping_is_off() =>
        Assert.Equal(new ShippingQuoteDto(DeliveryMethod.Local, 49m), await Quote(LocalCp, 799m, localFreeShipping: false));

    [Fact]
    public async Task Parcel_below_threshold_pays_the_parcel_rate() =>
        Assert.Equal(new ShippingQuoteDto(DeliveryMethod.Paqueteria, 99m), await Quote(OtherCp, 798.99m));

    [Fact]
    public async Task Parcel_at_threshold_is_free_even_when_local_free_shipping_is_off() =>
        Assert.Equal(new ShippingQuoteDto(DeliveryMethod.Paqueteria, 0m), await Quote(OtherCp, 799m, localFreeShipping: false));
}
