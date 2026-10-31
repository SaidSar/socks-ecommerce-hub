using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

public class AdminTaxonomyApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private readonly string _suffix = Guid.NewGuid().ToString("N")[..8];

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    /// <summary>Solo las pruebas borran de verdad; la API nunca lo hace.</summary>
    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Brands.Where(b => b.Slug.Contains(_suffix)).ExecuteDeleteAsync();
        await db.Collections.Where(c => c.Slug.Contains(_suffix)).ExecuteDeleteAsync();
        await db.ProductTypes.Where(t => t.Code.Contains(_suffix)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    public static TheoryData<string> Lists => new() { "/api/admin/brands", "/api/admin/brands/nike", "/api/admin/product-types", "/api/admin/product-types/guantes", "/api/admin/collections", "/api/admin/collections/navidad" };

    [Theory]
    [MemberData(nameof(Lists))]
    public async Task Reads_are_for_staff(string url)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get(url, null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Get(url, Customer)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Get(url, Operations)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Get(url, Owner)).StatusCode);
    }

    [Theory]
    [InlineData("/api/admin/brands/no-existe")]
    [InlineData("/api/admin/product-types/no-existe")]
    [InlineData("/api/admin/collections/no-existe")]
    public async Task Missing_returns_404(string url) =>
        Assert.Equal(HttpStatusCode.NotFound, (await Get(url, Owner)).StatusCode);

    [Theory]
    [InlineData("/api/admin/brands")]
    [InlineData("/api/admin/product-types")]
    [InlineData("/api/admin/collections")]
    public async Task Writes_are_only_for_the_owner(string url)
    {
        var body = new { name = "No debe existir", code = "no-debe", sizeSystem = "unitalla", unit = "pieza", kind = "tematica" };
        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(url, null, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Post(url, Customer, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Post(url, Operations, body)).StatusCode);
    }

    [Fact]
    public async Task Brand_is_created_and_duplicates_are_rejected_ignoring_case()
    {
        var created = await Post("/api/admin/brands", Owner, new { name = $"Marca {_suffix}" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var brand = await Json(created);
        Assert.Equal($"marca-{_suffix}", brand.GetProperty("slug").GetString());
        Assert.True(brand.GetProperty("showInFilters").GetBoolean());

        var duplicate = await Post("/api/admin/brands", Owner, new { name = $"MARCA {_suffix.ToUpperInvariant()}" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Contains("Ya existe la marca", (await Json(duplicate)).GetProperty("errors").GetProperty("name").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Post("/api/admin/brands", Owner, new { name = "" })).StatusCode);
    }

    [Fact]
    public async Task Brand_visibility_changes_with_row_version_and_stale_edit_gets_409()
    {
        var brand = await Json(await Post("/api/admin/brands", Owner, new { name = $"Visible {_suffix}" }));
        var url = $"/api/admin/brands/{brand.GetProperty("slug").GetString()}";
        var version = brand.GetProperty("rowVersion").GetString();

        var hidden = await Put(url, Owner, new { showInFilters = false, rowVersion = version });
        Assert.Equal(HttpStatusCode.OK, hidden.StatusCode);
        Assert.False((await Json(hidden)).GetProperty("showInFilters").GetBoolean());

        var stale = await Put(url, Owner, new { showInFilters = true, rowVersion = version });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Contains("Otra persona", (await Json(stale)).GetProperty("title").GetString());

        Assert.Equal(HttpStatusCode.BadRequest, (await Put(url, Owner, new { showInFilters = true })).StatusCode);
    }

    [Fact]
    public async Task Own_brand_stays_visible_and_a_brand_with_products_is_not_deactivated()
    {
        var sokko = await Json(await Get("/api/admin/brands/sokko", Owner));
        var hide = await Put("/api/admin/brands/sokko", Owner, new { showInFilters = false, rowVersion = sokko.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Conflict, hide.StatusCode);

        var nike = await Json(await Get("/api/admin/brands/nike", Owner));
        var off = await Put("/api/admin/brands/nike", Owner, new { isActive = false, rowVersion = nike.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Conflict, off.StatusCode);
    }

    [Fact]
    public async Task Product_type_rejects_a_new_size_system_when_it_has_products()
    {
        var guantes = await Json(await Get("/api/admin/product-types/guantes", Owner));
        var change = await Put("/api/admin/product-types/guantes", Owner, new { sizeSystem = "unitalla", rowVersion = guantes.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.Conflict, change.StatusCode);
        Assert.Contains("sistema de tallas", (await Json(change)).GetProperty("title").GetString());

        var code = $"t-{_suffix}";
        var created = await Post("/api/admin/product-types", Owner, new { code, name = $"Tipo {_suffix}", sizeSystem = "unitalla", unit = "pieza" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var type = await Json(created);
        var free = await Put($"/api/admin/product-types/{code}", Owner, new { sizeSystem = "guante", unit = "par", rowVersion = type.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.OK, free.StatusCode);
        Assert.Equal("guante", (await Json(free)).GetProperty("sizeSystem").GetString());

        Assert.Equal(HttpStatusCode.Conflict, (await Post("/api/admin/product-types", Owner, new { code, name = "Otro", sizeSystem = "unitalla", unit = "pieza" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post("/api/admin/product-types", Owner, new { code = "MAL CODIGO", name = "Otro", sizeSystem = "unitalla", unit = "pieza" })).StatusCode);
    }

    private async Task<JsonElement> CreateCollection(string suffix = "")
    {
        var response = await Post("/api/admin/collections", Owner, new
        {
            name = $"Temporada {_suffix}{suffix}", kind = "temporada", startMonth = 12, startDay = 1, endMonth = 1, endDay = 6, offSeasonDiscountPct = 0.25m,
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Json(response);
    }

    [Fact]
    public async Task Collection_window_can_cross_the_year()
    {
        var collection = await CreateCollection();

        Assert.Equal(12, collection.GetProperty("startMonth").GetInt32());
        Assert.Equal(1, collection.GetProperty("endMonth").GetInt32());
        Assert.Equal(0.25m, collection.GetProperty("offSeasonDiscountPct").GetDecimal());
    }

    [Theory]
    [InlineData(2, 29, 3, 1, 0.3, "window")]
    [InlineData(1, 1, 2, 29, 0.3, "window")]
    [InlineData(4, 31, 5, 1, 0.3, "window")]
    [InlineData(13, 1, 5, 1, 0.3, "window")]
    [InlineData(1, 1, 2, 1, 0.61, "discount")]
    [InlineData(1, 1, 2, 1, -0.01, "discount")]
    public async Task Collection_rejects_invalid_window_and_discount(int startMonth, int startDay, int endMonth, int endDay, double discount, string field)
    {
        var body = new { name = $"Inválida {_suffix}", kind = "temporada", startMonth, startDay, endMonth, endDay, offSeasonDiscountPct = (decimal)discount };

        var response = await Post("/api/admin/collections", Owner, body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty(field, out _));
    }

    [Fact]
    public async Task Discount_of_60_percent_is_accepted_and_themed_collection_clears_the_window()
    {
        var collection = await CreateCollection("b");
        var url = $"/api/admin/collections/{collection.GetProperty("slug").GetString()}";

        var edited = await Put(url, Owner, new { kind = "temporada", startMonth = 2, startDay = 28, endMonth = 3, endDay = 1, offSeasonDiscountPct = 0.6m, rowVersion = collection.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.OK, edited.StatusCode);
        var season = await Json(edited);
        Assert.Equal(0.6m, season.GetProperty("offSeasonDiscountPct").GetDecimal());

        var themed = await Put(url, Owner, new { kind = "tematica", rowVersion = season.GetProperty("rowVersion").GetString() });
        Assert.Equal(HttpStatusCode.OK, themed.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await Json(themed)).GetProperty("startMonth").ValueKind);
    }

    [Fact]
    public async Task Stale_collection_edit_gets_409_and_active_products_block_deactivation()
    {
        var collection = await CreateCollection("c");
        var url = $"/api/admin/collections/{collection.GetProperty("slug").GetString()}";
        var version = collection.GetProperty("rowVersion").GetString();
        var body = new { kind = "temporada", startMonth = 12, startDay = 2, endMonth = 1, endDay = 6, rowVersion = version };

        Assert.Equal(HttpStatusCode.OK, (await Put(url, Owner, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Put(url, Owner, body)).StatusCode);

        var navidad = await Json(await Get("/api/admin/collections/navidad", Owner));
        var off = await Put("/api/admin/collections/navidad", Owner, new
        {
            kind = "temporada", startMonth = 11, startDay = 1, endMonth = 1, endDay = 6, isActive = false, rowVersion = navidad.GetProperty("rowVersion").GetString(),
        });
        Assert.Equal(HttpStatusCode.Conflict, off.StatusCode);
    }
}
