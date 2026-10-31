using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sokko.Api.Data;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>API real contra la BD de Development con la semilla de DESIGN_DB §5 y la fecha fija.</summary>
public sealed class CatalogApiFactory : WebApplicationFactory<Program>
{
    internal FakeClock Clock { get; } = new(new DateOnly(2026, 10, 26));

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<IClock>(Clock)));
    }
}

/// <summary>Forma del JSON de cada endpoint público (DESIGN_DB §3.12).</summary>
public class CatalogApiTests(CatalogApiFactory factory) : IClassFixture<CatalogApiFactory>
{
    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private async Task<JsonElement> GetJson(string url)
    {
        var response = await _client.GetAsync(url, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
    }

    private static string[] Slugs(JsonElement page) =>
        page.GetProperty("items").EnumerateArray().Select(p => p.GetProperty("slug").GetString()!).ToArray();

    private static string[] Strings(JsonElement list, string property) =>
        list.EnumerateArray().Select(x => x.GetProperty(property).GetString()!).ToArray();

    [Fact]
    public async Task Products_list_applies_the_season_rule()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var october = Slugs(await GetJson("/api/products?line=especiales"));
        Assert.Equal(["calabaza-nocturna", "telarana-nocturna", "luna-de-calabazas", "pokemon-pikachu", "marvel-avengers"], october);

        factory.Clock.Today = new DateOnly(2026, 12, 15);
        var december = Slugs(await GetJson("/api/products?line=especiales"));
        Assert.Equal(["copo-navideno", "reno-de-lana", "duendes-del-bosque", "pokemon-pikachu", "marvel-avengers"], december);
    }

    [Theory]
    [InlineData(2026, 10, 31, false)]
    [InlineData(2026, 11, 1, true)]
    [InlineData(2027, 1, 6, true)]
    [InlineData(2027, 1, 7, false)]
    [InlineData(2028, 2, 29, false)]
    public async Task Sql_filter_matches_the_window_rule(int year, int month, int day, bool expected)
    {
        factory.Clock.Today = new DateOnly(year, month, day);
        var page = await GetJson("/api/products?collection=navidad");
        Assert.Equal(expected, Slugs(page).Contains("copo-navideno"));
    }

    [Fact]
    public async Task Product_item_has_the_documented_shape()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var response = await _client.GetAsync("/api/products?brand=puma", Ct);
        var body = await response.Content.ReadAsStringAsync(Ct);
        var page = JsonDocument.Parse(body).RootElement;

        Assert.Equal(1, page.GetProperty("total").GetInt32());
        Assert.Equal(1, page.GetProperty("page").GetInt32());
        Assert.Equal(24, page.GetProperty("pageSize").GetInt32());

        var item = page.GetProperty("items")[0];
        Assert.Equal(102, item.GetProperty("id").GetInt32());
        Assert.Equal("puma-quarter-3", item.GetProperty("slug").GetString());
        Assert.Equal("marcas", item.GetProperty("line").GetString());
        Assert.Equal("puma", item.GetProperty("brand").GetProperty("slug").GetString());
        Assert.Equal("calcetas", item.GetProperty("type").GetProperty("code").GetString());
        Assert.Equal("par", item.GetProperty("type").GetProperty("unitLabel").GetString());
        Assert.Equal("calceta", item.GetProperty("type").GetProperty("sizeSystem").GetString());
        Assert.Equal(JsonValueKind.Null, item.GetProperty("collection").ValueKind);
        Assert.Equal(JsonValueKind.Null, item.GetProperty("nameJp").ValueKind);
        Assert.Equal(3, item.GetProperty("unitsPerPack").GetInt32());
        Assert.Equal(329m, item.GetProperty("price").GetDecimal());
        Assert.Equal(329m, item.GetProperty("finalPrice").GetDecimal());
        Assert.False(item.GetProperty("offSeason").GetBoolean());
        Assert.Equal(0m, item.GetProperty("discountPct").GetDecimal());

        var variant = item.GetProperty("variants")[0];
        Assert.Equal("MRC-002-NEG-S", variant.GetProperty("sku").GetString());
        Assert.Equal("negro", variant.GetProperty("color").GetString());
        Assert.Equal("S", variant.GetProperty("size").GetString());
        Assert.Equal(3, variant.GetProperty("stock").GetInt32());

        var color = item.GetProperty("colors")[0];
        Assert.Equal("NEG", color.GetProperty("code").GetString());
        Assert.Equal("#1F1D1B", color.GetProperty("hex").GetString());

        Assert.False(item.TryGetProperty("sizes", out _));
        Assert.DoesNotContain("unitCost", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Search_includes_inactive_season_with_discounted_price()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var page = await GetJson("/api/products?q=navidad");
        var copo = page.GetProperty("items").EnumerateArray().Single(p => p.GetProperty("slug").GetString() == "copo-navideno");

        Assert.Equal(199m, copo.GetProperty("price").GetDecimal());
        Assert.Equal(139.30m, copo.GetProperty("finalPrice").GetDecimal());
        Assert.True(copo.GetProperty("offSeason").GetBoolean());
        Assert.Equal(0.30m, copo.GetProperty("discountPct").GetDecimal());
        Assert.False(copo.GetProperty("collection").GetProperty("inSeason").GetBoolean());
    }

    [Theory]
    [InlineData("POKEMON", "pokemon-pikachu")]
    [InlineData("NAVIDEÑO", "copo-navideno")]
    [InlineData("uv400", "lentes-de-sol-polarizados")]
    [InlineData("navideno", "copo-navideno")]
    [InlineData("telarana", "telarana-nocturna")]
    [InlineData("bufandas", "bufanda-de-lana")]
    [InlineData("marcas", "ua-heatgear-crew")]
    [InlineData("japon", "lino-komorebi")]
    public async Task Search_ignores_case_and_accents_and_reads_material(string term, string expected) =>
        Assert.Contains(expected, Slugs(await GetJson($"/api/products?q={Uri.EscapeDataString(term)}")));

    [Theory]
    [InlineData("/api/products?brand=under-armour", "ua-heatgear-crew")]
    [InlineData("/api/products?type=guantes", "guantes-tactiles")]
    [InlineData("/api/products?collection=anime", "pokemon-pikachu")]
    public async Task Filters_select_the_expected_product(string url, string expected)
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        Assert.Equal([expected], Slugs(await GetJson(url)));
    }

    [Fact]
    public async Task Pagination_limits_items_and_keeps_the_total()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var page = await GetJson("/api/products?line=sokko&page=2&pageSize=4");
        Assert.Equal(6, page.GetProperty("total").GetInt32());
        Assert.Equal(2, page.GetProperty("items").GetArrayLength());
    }

    [Theory]
    [InlineData("/api/products?line=calzado")]
    [InlineData("/api/products?page=0")]
    [InlineData("/api/products?pageSize=49")]
    public async Task Invalid_filters_return_problem_details(string url)
    {
        var response = await _client.GetAsync(url, Ct);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task Detail_works_for_inactive_season_and_includes_sizes()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var copo = await GetJson("/api/products/copo-navideno");

        Assert.True(copo.GetProperty("offSeason").GetBoolean());
        Assert.Equal(139.30m, copo.GetProperty("finalPrice").GetDecimal());
        Assert.Equal(["S", "M", "L"], Strings(copo.GetProperty("sizes"), "code"));
        Assert.Equal("22–24 cm", copo.GetProperty("sizes")[0].GetProperty("label").GetString());
        Assert.Equal(11, copo.GetProperty("collection").GetProperty("startMonth").GetInt32());
        Assert.Equal("rojo", copo.GetProperty("variants")[0].GetProperty("color").GetString());
    }

    [Fact]
    public async Task Listing_keeps_the_store_seed_order()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var page = await GetJson("/api/products?line=sokko");
        Assert.Equal(["tabi-origami-noche", "lino-komorebi", "kintsugi-washi", "hanami-laca", "tsuchi-raiz", "mizu-calma"], Slugs(page));
        Assert.Equal(["WAS", "SUM", "LAC"], Strings(page.GetProperty("items")[2].GetProperty("colors"), "code"));
    }

    [Fact]
    public async Task Detail_exposes_available_stock_by_color_and_size()
    {
        const string sku = "SKK-003-WAS-S";
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();

        var variants = (await GetJson("/api/products/kintsugi-washi")).GetProperty("variants");
        int StockOf(JsonElement list, string code) =>
            list.EnumerateArray().Single(v => v.GetProperty("sku").GetString() == code).GetProperty("stock").GetInt32();
        Assert.Equal(1, StockOf(variants, sku));
        Assert.Equal(0, StockOf(variants, "SKK-003-SUM-S"));

        // Disponible = Stock - Reserved.
        await db.ProductVariants.Where(v => v.Sku == sku).ExecuteUpdateAsync(u => u.SetProperty(v => v.Reserved, 1), Ct);
        try
        {
            Assert.Equal(0, StockOf((await GetJson("/api/products/kintsugi-washi")).GetProperty("variants"), sku));
        }
        finally
        {
            await db.ProductVariants.Where(v => v.Sku == sku).ExecuteUpdateAsync(u => u.SetProperty(v => v.Reserved, 0), CancellationToken.None);
        }
    }

    [Fact]
    public async Task Detail_returns_404_when_missing_or_inactive()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/products/no-existe", Ct)).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var inactive = new Product
        {
            Line = ProductLine.Marcas,
            PieceNumber = 999,
            Slug = "prueba-inactivo",
            BrandId = 2,
            ProductTypeId = 1,
            Name = "Producto inactivo de prueba",
            Material = "Prueba",
            Price = 100m,
            IsActive = false,
        };
        db.Products.Add(inactive);
        await db.SaveChangesAsync(Ct);
        try
        {
            Assert.Equal(HttpStatusCode.NotFound, (await _client.GetAsync("/api/products/prueba-inactivo", Ct)).StatusCode);
        }
        finally
        {
            db.Products.Remove(inactive);
            await db.SaveChangesAsync(CancellationToken.None);
        }
    }

    [Fact]
    public async Task Nav_has_the_documented_shape()
    {
        factory.Clock.Today = new DateOnly(2026, 10, 26);
        var nav = await GetJson("/api/catalog/nav");

        var lines = nav.GetProperty("lines");
        Assert.Equal(["sokko", "marcas", "especiales", "accesorios"], Strings(lines, "code"));
        Assert.Equal("SOKKO Japón", lines[0].GetProperty("label").GetString());

        var especiales = lines[2];
        Assert.Equal(5, especiales.GetProperty("count").GetInt32());
        Assert.Equal(3, especiales.GetProperty("hiddenCount").GetInt32());
        Assert.Equal(["navidad"], Strings(especiales.GetProperty("hiddenCollections"), "slug"));

        var brands = Strings(nav.GetProperty("brands"), "slug");
        Assert.Contains("nike", brands);
        Assert.DoesNotContain("sin-marca", brands);
        Assert.Contains("under-armour", brands);
        Assert.Contains("marvel", brands);

        Assert.Equal(["halloween", "anime", "superheroes"], Strings(nav.GetProperty("collections"), "slug"));
        Assert.Equal("temporada", nav.GetProperty("collections")[0].GetProperty("kind").GetString());
        Assert.Contains("guantes", Strings(nav.GetProperty("types"), "code"));
        Assert.Equal("tabi-origami-noche", nav.GetProperty("featuredSlug").GetString());
    }

    [Fact]
    public async Task Config_has_the_documented_shape()
    {
        var config = await GetJson("/api/config");

        Assert.Equal(799m, config.GetProperty("freeShippingThreshold").GetDecimal());
        Assert.Equal(99m, config.GetProperty("parcelShippingCost").GetDecimal());
        Assert.Equal(49m, config.GetProperty("localShippingCost").GetDecimal());
        Assert.True(config.GetProperty("localFreeShipping").GetBoolean());
        Assert.Equal(4, config.GetProperty("fewUnitsThreshold").GetInt32());
        Assert.Equal(0.16m, config.GetProperty("ivaRate").GetDecimal());
    }

    [Theory]
    [InlineData("81250", 100, "local", 49)]
    [InlineData("81399", 100, "local", 49)]
    [InlineData("81250", 800, "local", 0)]
    [InlineData("06700", 100, "paqueteria", 99)]
    [InlineData("06700", 800, "paqueteria", 0)]
    public async Task Quote_returns_method_and_cost(string postalCode, int subtotal, string method, int cost)
    {
        var response = await _client.PostAsJsonAsync("/api/shipping/quote", new { postalCode, subtotal }, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var quote = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.Equal(method, quote.GetProperty("method").GetString());
        Assert.Equal(cost, quote.GetProperty("cost").GetDecimal());
    }

    [Theory]
    [InlineData("123")]
    [InlineData("8125a")]
    [InlineData("812500")]
    [InlineData("")]
    public async Task Quote_rejects_an_invalid_postal_code(string postalCode)
    {
        var response = await _client.PostAsJsonAsync("/api/shipping/quote", new { postalCode, subtotal = 100 }, Ct);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        var problem = await response.Content.ReadFromJsonAsync<JsonElement>(Ct);
        Assert.True(problem.GetProperty("errors").TryGetProperty("PostalCode", out _));
    }
}
