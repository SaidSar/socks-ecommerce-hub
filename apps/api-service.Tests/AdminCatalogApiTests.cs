using System.Net;
using System.Reflection;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.DTOs;

namespace Sokko.Api.Tests;

public class AdminCatalogApiTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    private static readonly string[] MoneyWords = ["price", "cost", "margin", "revenue", "sales", "profit", "income", "total", "amount"];

    private readonly List<string> _slugs = [];

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    /// <summary>Solo las pruebas borran de verdad; la API nunca lo hace.</summary>
    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.ProductVariants.Where(v => _slugs.Contains(v.Product.Slug)).ExecuteDeleteAsync();
        await db.Products.Where(p => _slugs.Contains(p.Slug)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private static object NewProduct(string name, string line = "accesorios", string brand = "sin-marca", string type = "lentes", string[]? colors = null,
        string? collection = null, decimal? price = 250m, decimal? unitCost = 100m, object? barcodes = null, string? nameJp = null) => new
    {
        line, name, nameJp, material = "Prueba", brand, type, collection, unitsPerPack = 1, price, unitCost, colors = colors ?? ["NEG"], barcodes,
    };

    private async Task<JsonElement> Create(string name, object? body = null)
    {
        var response = await Post("/api/admin/products", Owner, body ?? NewProduct(name));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var product = await Json(response);
        _slugs.Add(product.GetProperty("slug").GetString()!);
        return product;
    }

    private static object Edit(JsonElement product, string name, string? rowVersion = null, decimal price = 300m, object? barcodes = null, string[]? colors = null, bool? isActive = null) => new
    {
        name,
        brand = product.GetProperty("brand").GetProperty("slug").GetString(),
        type = product.GetProperty("type").GetProperty("code").GetString(),
        price,
        unitCost = 100m,
        colors = colors ?? product.GetProperty("colors").EnumerateArray().Select(c => c.GetProperty("code").GetString()).ToArray(),
        barcodes,
        isActive,
        rowVersion = rowVersion ?? product.GetProperty("rowVersion").GetString(),
    };

    private static async Task AssertFieldError(HttpResponseMessage response, string field, string? contains = null)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await Json(response)).GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out var messages), $"Sin error en {field}: {errors}");
        if (contains is not null)
        {
            Assert.Contains(contains, messages[0].GetString());
        }
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.OK)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Catalog_and_products_require_a_staff_role(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get("/api/admin/catalog", role)).StatusCode);
        Assert.Equal(expected, (await Get("/api/admin/products", role)).StatusCode);
        Assert.Equal(expected, (await Get("/api/admin/products/tabi-origami-noche", role)).StatusCode);
    }

    [Fact]
    public async Task Missing_product_returns_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Get("/api/admin/products/no-existe", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Put("/api/admin/products/no-existe", Owner, new { name = "x" })).StatusCode);
    }

    [Fact]
    public async Task Owner_sees_money_and_operations_never_receives_it()
    {
        var owner = await Json(await Get("/api/admin/products/tabi-origami-noche", Owner));
        Assert.Equal(420m, owner.GetProperty("price").GetDecimal());
        Assert.Equal(168m, owner.GetProperty("unitCost").GetDecimal());
        Assert.Equal(0.6m, owner.GetProperty("margin").GetDecimal());
        var navidad = await Json(await Get("/api/admin/collections/navidad", Owner));
        Assert.True(navidad.GetProperty("products")[0].TryGetProperty("price", out _));

        foreach (var url in new[] { "/api/admin/products/tabi-origami-noche", "/api/admin/products", "/api/admin/catalog", "/api/admin/collections", "/api/admin/collections/navidad", "/api/admin/brands", "/api/admin/product-types" })
        {
            var response = await Get(url, Operations);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            // Las claves, no los valores: un nombre o material puede contener esas letras sin ser un importe.
            var keys = JsonKeys(await Json(response)).Distinct().ToList();
            Assert.NotEmpty(keys);
            Assert.DoesNotContain(keys, key => MoneyWords.Any(word => key.Contains(word, StringComparison.OrdinalIgnoreCase)));
        }
    }

    [Theory]
    [InlineData(typeof(OperationsProductDto))]
    [InlineData(typeof(OperationsCollectionDto))]
    [InlineData(typeof(AdminCatalogDto<OperationsProductDto, OperationsCollectionDto>))]
    public void Operations_dtos_have_no_money(Type type)
    {
        // R-24: el tipo no tiene esos campos; no basta con dejarlos en null. Tampoco hay ningún importe de tipo decimal,
        // salvo el descuento, que es un porcentaje.
        var properties = AllProperties(type, []).ToList();
        Assert.NotEmpty(properties);
        foreach (var property in properties)
        {
            Assert.DoesNotContain(MoneyWords, word => property.Name.Contains(word, StringComparison.OrdinalIgnoreCase));
            if (Nullable.GetUnderlyingType(property.PropertyType) == typeof(decimal) || property.PropertyType == typeof(decimal))
            {
                Assert.Equal("OffSeasonDiscountPct", property.Name);
            }
        }
    }

    private static IEnumerable<string> JsonKeys(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => element.EnumerateObject().SelectMany(p => JsonKeys(p.Value).Prepend(p.Name)),
        JsonValueKind.Array => element.EnumerateArray().SelectMany(JsonKeys),
        _ => [],
    };

    private static IEnumerable<PropertyInfo> AllProperties(Type type, HashSet<Type> seen)
    {
        if (type.IsGenericType && type.GetGenericArguments() is { Length: > 0 } args && type.Namespace?.StartsWith("System") == true)
        {
            return args.SelectMany(a => AllProperties(a, seen));
        }
        if (type.Namespace?.StartsWith("Sokko.Api.DTOs") != true || !seen.Add(type))
        {
            return [];
        }
        var properties = type.GetProperties(BindingFlags.Public | BindingFlags.Instance).Where(p => p.Name != "EqualityContract").ToList();
        return properties.Concat(properties.SelectMany(p => AllProperties(p.PropertyType, seen)));
    }

    [Fact]
    public void Owner_dto_is_the_one_that_adds_the_money()
    {
        var owner = typeof(OwnerProductDto).GetProperties().Select(p => p.Name).ToHashSet();
        var operations = typeof(OperationsProductDto).GetProperties().Select(p => p.Name).ToHashSet();
        Assert.Equal(["Margin", "OffSeasonPrice", "Price", "UnitCost"], owner.Except(operations).Order());
    }

    [Fact]
    public async Task Catalog_has_the_shape_the_panel_expects()
    {
        var catalog = await Json(await Get("/api/admin/catalog", Owner));

        Assert.True(catalog.GetProperty("today").GetProperty("month").GetInt32() is >= 1 and <= 12);
        var product = catalog.GetProperty("products").EnumerateArray().Single(p => p.GetProperty("slug").GetString() == "kintsugi-washi");
        Assert.Equal("sokko", product.GetProperty("line").GetString());
        Assert.Equal("par", product.GetProperty("type").GetProperty("unit").GetString());
        // Los pedidos demo solo mueven SOKKO: Marvel conserva el stock de la semilla.
        Assert.Equal(3, catalog.GetProperty("products").EnumerateArray().Single(p => p.GetProperty("slug").GetString() == "marvel-avengers").GetProperty("stock").GetInt32());
        Assert.Equal("WAS", product.GetProperty("colors")[0].GetProperty("code").GetString());
        Assert.Equal("washi", product.GetProperty("colors")[0].GetProperty("apiCode").GetString());
        Assert.Equal("SKK-003-WAS-S", product.GetProperty("variants")[0].GetProperty("sku").GetString());
        Assert.Equal("22–24 cm", product.GetProperty("variants")[0].GetProperty("sizeLabel").GetString());

        var marvel = catalog.GetProperty("brands").EnumerateArray().Single(b => b.GetProperty("slug").GetString() == "marvel");
        Assert.Equal(1, marvel.GetProperty("products").GetInt32());
        Assert.Equal("especiales", marvel.GetProperty("lines")[0].GetString());

        var navidad = catalog.GetProperty("collections").EnumerateArray().Single(c => c.GetProperty("slug").GetString() == "navidad");
        Assert.Equal(11, navidad.GetProperty("startMonth").GetInt32());
        Assert.Equal(3, navidad.GetProperty("products").GetArrayLength());

        Assert.Equal(3, catalog.GetProperty("sizes").GetProperty("calceta").GetArrayLength());
        Assert.Equal("U", catalog.GetProperty("sizes").GetProperty("unitalla")[0].GetProperty("code").GetString());
        Assert.Equal(7, catalog.GetProperty("types").GetArrayLength());
        Assert.Equal(14, catalog.GetProperty("colors").GetArrayLength());
    }

    [Fact]
    public async Task Create_generates_slug_piece_and_skus_with_zero_stock()
    {
        var product = await Create("Lentes de Prueba Únicos", NewProduct("Lentes de Prueba Únicos", colors: ["NEG", "BLA"]));

        Assert.Equal("lentes-de-prueba-unicos", product.GetProperty("slug").GetString());
        var piece = product.GetProperty("pieceNumber").GetInt32();
        Assert.True(piece > 6);
        var variants = product.GetProperty("variants").EnumerateArray().ToList();
        Assert.Equal([$"ACC-{piece:000}-NEG-U", $"ACC-{piece:000}-BLA-U"], variants.Select(v => v.GetProperty("sku").GetString()));
        Assert.All(variants, v => Assert.Equal(0, v.GetProperty("stock").GetInt32()));
        Assert.Equal(100m, product.GetProperty("unitCost").GetDecimal());
    }

    [Fact]
    public async Task Operations_and_customers_cannot_write()
    {
        var created = await Create($"Solo Dueño {Guid.NewGuid():N}");
        var slug = created.GetProperty("slug").GetString();

        foreach (var (role, status) in new (string?, HttpStatusCode)[] { (Operations, HttpStatusCode.Forbidden), (Customer, HttpStatusCode.Forbidden), (null, HttpStatusCode.Unauthorized) })
        {
            Assert.Equal(status, (await Post("/api/admin/products", role, NewProduct("No debe existir"))).StatusCode);
            Assert.Equal(status, (await Put($"/api/admin/products/{slug}", role, Edit(created, "No debe cambiar"))).StatusCode);
        }
    }

    [Fact]
    public async Task Validation_applies_r31_r32_and_r30()
    {
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("")), "name");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", price: 0m)), "price");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", unitCost: -1m)), "unitCost", "negativo");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", line: "especiales", type: "calcetas")), "collection", "obligatoria");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", line: "sokko", type: "calcetas", colors: ["SUM"], nameJp: "夜")), "brand", "marca propia");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", brand: "sokko")), "brand", "exclusiva");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", colors: ["SUM"])), "colors", "Kyoto");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", line: "sokko", brand: "sokko", type: "calcetas", colors: ["NEG"], nameJp: "夜")), "colors", "Kyoto");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", line: "sokko", brand: "sokko", type: "calcetas", colors: ["SUM"])), "nameJp");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", line: "otra")), "line");
        await AssertFieldError(await Post("/api/admin/products", Owner, NewProduct("X", colors: [])), "colors");
    }

    [Fact]
    public async Task Barcode_must_be_unique()
    {
        var code = Random.Shared.NextInt64(100_000_000_000, 999_999_999_999).ToString();
        var first = await Create($"Con código {code}");
        var sku = first.GetProperty("variants")[0].GetProperty("sku").GetString()!;
        var slug = first.GetProperty("slug").GetString();
        var saved = await Put($"/api/admin/products/{slug}", Owner, Edit(first, "Con código", barcodes: new Dictionary<string, string> { [sku] = code }));
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal(code, (await Json(saved)).GetProperty("variants")[0].GetProperty("barcode").GetString());

        var second = await Create($"Otro con código {code}");
        var otherSku = second.GetProperty("variants")[0].GetProperty("sku").GetString()!;
        var repeated = await Put($"/api/admin/products/{second.GetProperty("slug").GetString()}", Owner, Edit(second, "Otro", barcodes: new Dictionary<string, string> { [otherSku] = code }));

        await AssertFieldError(repeated, $"barcode:{otherSku}", sku);
    }

    [Fact]
    public async Task Second_edit_with_a_stale_row_version_gets_409()
    {
        var product = await Create($"Concurrente {Guid.NewGuid():N}");
        var slug = product.GetProperty("slug").GetString();

        var first = await Put($"/api/admin/products/{slug}", Owner, Edit(product, "Primera edición", price: 300m));
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);

        var second = await Put($"/api/admin/products/{slug}", Owner, Edit(product, "Segunda edición", price: 400m));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Equal("application/problem+json", second.Content.Headers.ContentType?.MediaType);
        Assert.Contains("Otra persona", (await Json(second)).GetProperty("title").GetString());

        var current = await Json(await Get($"/api/admin/products/{slug}", Owner));
        Assert.Equal("Primera edición", current.GetProperty("name").GetString());
        Assert.Equal(300m, current.GetProperty("price").GetDecimal());
    }

    [Fact]
    public async Task Edit_without_row_version_is_rejected()
    {
        var product = await Create($"Sin versión {Guid.NewGuid():N}");

        var response = await Put($"/api/admin/products/{product.GetProperty("slug").GetString()}", Owner, new
        {
            name = "X", brand = "sin-marca", type = "lentes", price = 100m, colors = new[] { "NEG" },
        });

        await AssertFieldError(response, "rowVersion");
    }

    [Fact]
    public async Task Removed_color_is_deactivated_and_logical_delete_hides_the_product_from_the_store()
    {
        var product = await Create($"Baja lógica {Guid.NewGuid():N}", NewProduct($"Baja lógica {Guid.NewGuid():N}", colors: ["NEG", "BLA"]));
        var slug = product.GetProperty("slug").GetString();

        var fewer = await Put($"/api/admin/products/{slug}", Owner, Edit(product, "Baja lógica", colors: ["NEG"]));
        Assert.Equal(HttpStatusCode.OK, fewer.StatusCode);
        var edited = await Json(fewer);
        Assert.Single(edited.GetProperty("variants").EnumerateArray());

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            // La fila sigue: es baja lógica.
            Assert.Equal(2, await db.ProductVariants.CountAsync(v => v.Product.Slug == slug, Ct));
        }

        Assert.Equal(HttpStatusCode.OK, (await Get($"/api/products/{slug}", null)).StatusCode);
        var hidden = await Put($"/api/admin/products/{slug}", Owner, Edit(edited, "Baja lógica", colors: ["NEG"], isActive: false));
        Assert.Equal(HttpStatusCode.OK, hidden.StatusCode);
        Assert.False((await Json(hidden)).GetProperty("isActive").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/products/{slug}", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Get($"/api/admin/products/{slug}", Owner)).StatusCode);
    }

    [Fact]
    public async Task Size_system_cannot_change_and_reserved_variant_cannot_be_removed()
    {
        var product = await Create($"Reservado {Guid.NewGuid():N}", NewProduct($"Reservado {Guid.NewGuid():N}", colors: ["NEG", "BLA"]));
        var slug = product.GetProperty("slug").GetString();

        var body = new
        {
            name = "X", brand = "sin-marca", type = "calcetas", price = 100m, colors = new[] { "NEG" }, rowVersion = product.GetProperty("rowVersion").GetString(),
        };
        await AssertFieldError(await Put($"/api/admin/products/{slug}", Owner, body), "type", "sistema de tallas");

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var sku = product.GetProperty("variants")[1].GetProperty("sku").GetString();
            await db.ProductVariants.Where(v => v.Sku == sku).ExecuteUpdateAsync(u => u.SetProperty(v => v.Stock, 1).SetProperty(v => v.Reserved, 1), Ct);
        }

        var response = await Put($"/api/admin/products/{slug}", Owner, Edit(product, "X", colors: ["NEG"]));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("apartadas", (await Json(response)).GetProperty("errors").GetProperty("colors").GetString());
    }
}
