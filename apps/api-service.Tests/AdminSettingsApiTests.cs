using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Models;

namespace Sokko.Api.Tests;

public class AdminSettingsApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private const string Url = "/api/admin/settings";

    private Setting? _settings;
    private List<LocalDeliveryZone> _zones = [];

    /// <summary>Guarda la configuración para dejarla igual al terminar: otras pruebas la leen.</summary>
    public async ValueTask InitializeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        _settings = await db.Settings.AsNoTracking().SingleAsync();
        _zones = await db.LocalDeliveryZones.AsNoTracking().ToListAsync();
    }

    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var s = _settings!;
        await db.Settings.ExecuteUpdateAsync(u => u
            .SetProperty(x => x.FreeShippingThreshold, s.FreeShippingThreshold)
            .SetProperty(x => x.ParcelShippingCost, s.ParcelShippingCost)
            .SetProperty(x => x.LocalShippingCost, s.LocalShippingCost)
            .SetProperty(x => x.LocalFreeShipping, s.LocalFreeShipping)
            .SetProperty(x => x.FewUnitsThreshold, s.FewUnitsThreshold)
            .SetProperty(x => x.UpdatedByUserId, s.UpdatedByUserId)
            .SetProperty(x => x.UpdatedAt, s.UpdatedAt));
        var ids = _zones.Select(z => z.Id).ToList();
        await db.LocalDeliveryZones.Where(z => !ids.Contains(z.Id)).ExecuteDeleteAsync();
        foreach (var zone in _zones)
        {
            await db.LocalDeliveryZones.Where(z => z.Id == zone.Id).ExecuteUpdateAsync(u => u
                .SetProperty(x => x.Label, zone.Label)
                .SetProperty(x => x.IsConfirmed, zone.IsConfirmed)
                .SetProperty(x => x.IsActive, zone.IsActive));
        }
        GC.SuppressFinalize(this);
    }

    private static object Body(JsonElement current, decimal? threshold = 900m, decimal? parcel = 99m, decimal? local = 49m, int? few = 4, object? zones = null, string? rowVersion = null) => new
    {
        freeShippingThreshold = threshold,
        parcelShippingCost = parcel,
        localShippingCost = local,
        localFreeShipping = true,
        fewUnitsThreshold = few,
        localZones = zones ?? new object[] { new { value = "81200–81299", label = "Los Mochis" }, new { value = "81300–81399", label = "Ejidos de Ahome · por confirmar" } },
        rowVersion = rowVersion ?? current.GetProperty("rowVersion").GetString(),
    };

    private async Task<JsonElement> Current() => await Json(await Get(Url, Owner));

    [Fact]
    public async Task Only_the_owner_reads_and_writes_settings()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get(Url, null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Get(Url, Customer)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Get(Url, Operations)).StatusCode);

        var current = await Current();
        Assert.Equal(HttpStatusCode.Unauthorized, (await Put(Url, null, Body(current))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(Url, Operations, Body(current))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Put(Url, Customer, Body(current))).StatusCode);
    }

    [Fact]
    public async Task Read_has_the_shape_of_the_panel()
    {
        var current = await Current();

        Assert.Equal(799m, current.GetProperty("freeShippingThreshold").GetDecimal());
        Assert.Equal(0.16m, current.GetProperty("ivaRate").GetDecimal());
        var zones = current.GetProperty("localZones");
        Assert.Equal("81200–81299", zones[0].GetProperty("value").GetString());
        Assert.Equal("Los Mochis", zones[0].GetProperty("label").GetString());
        Assert.Equal("Ejidos de Ahome · por confirmar", zones[1].GetProperty("label").GetString());
    }

    [Fact]
    public async Task Saved_threshold_reaches_the_store_config_and_the_quote()
    {
        var saved = await Put(Url, Owner, Body(await Current(), threshold: 500m));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(500m, (await Json(saved)).GetProperty("freeShippingThreshold").GetDecimal());

        Assert.Equal(500m, (await Json(await Get("/api/config", null))).GetProperty("freeShippingThreshold").GetDecimal());
        var quote = await Post("/api/shipping/quote", null, new { postalCode = "06700", subtotal = 500 });
        Assert.Equal(0m, (await Json(quote)).GetProperty("cost").GetDecimal());
    }

    [Theory]
    [InlineData(0, 99, 49, 4, "freeShippingThreshold")]
    [InlineData(799.5, 99, 49, 4, "freeShippingThreshold")]
    [InlineData(799, -1, 49, 4, "parcelShippingCost")]
    [InlineData(799, 99.5, 49, 4, "parcelShippingCost")]
    [InlineData(799, 99, -1, 4, "localShippingCost")]
    [InlineData(799, 99, 49, 0, "fewUnitsThreshold")]
    public async Task Rejects_amounts_outside_r22(double threshold, double parcel, double local, int few, string field)
    {
        var response = await Put(Url, Owner, Body(await Current(), (decimal)threshold, (decimal)parcel, (decimal)local, few));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    public static TheoryData<object[]> BadZones => new()
    {
        Array.Empty<object>(),
        new object[] { new { value = "812", label = "Corto" } },
        new object[] { new { value = "81299–81200", label = "Al revés" } },
        new object[] { new { value = "81200–81299", label = "A" }, new { value = "81250", label = "Encimado" } },
        new object[] { new { value = "81200–81299", label = "A" }, new { value = "81299–81310", label = "Toca el borde" } },
    };

    [Theory]
    [MemberData(nameof(BadZones))]
    public async Task Rejects_zones_outside_r21(object[] zones)
    {
        var response = await Put(Url, Owner, Body(await Current(), zones: zones));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty("localZones", out _));
    }

    [Fact]
    public async Task Removed_zone_is_deactivated_and_stops_being_local()
    {
        var response = await Put(Url, Owner, Body(await Current(), zones: new object[] { new { value = "81200-81299", label = "Los Mochis" }, new { value = "22000", label = "Prueba" } }));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var zones = (await Json(response)).GetProperty("localZones");
        Assert.Equal(["22000", "81200–81299"], zones.EnumerateArray().Select(z => z.GetProperty("value").GetString()));

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        Assert.False(await db.LocalDeliveryZones.Where(z => z.PostalCodeFrom == "81300").Select(z => z.IsActive).SingleAsync(Ct));

        Assert.Equal("paqueteria", (await Json(await Post("/api/shipping/quote", null, new { postalCode = "81350", subtotal = 100 }))).GetProperty("method").GetString());
        Assert.Equal("local", (await Json(await Post("/api/shipping/quote", null, new { postalCode = "22000", subtotal = 100 }))).GetProperty("method").GetString());
    }

    [Fact]
    public async Task Stale_edit_gets_409()
    {
        var current = await Current();

        Assert.Equal(HttpStatusCode.OK, (await Put(Url, Owner, Body(current, threshold: 600m))).StatusCode);
        var stale = await Put(Url, Owner, Body(current, threshold: 700m));

        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Contains("Otra persona", (await Json(stale)).GetProperty("title").GetString());
        Assert.Equal(600m, (await Current()).GetProperty("freeShippingThreshold").GetDecimal());
    }
}
