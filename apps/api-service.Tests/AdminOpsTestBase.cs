using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Compras reales por la API de la tienda sobre productos desechables, para no tocar el stock de la semilla.</summary>
public abstract class AdminOpsTestBase(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>, IAsyncLifetime
{
    protected const string LocalPostalCode = "81250";
    protected const string ParcelPostalCode = "06700";

    private static readonly string[] MoneyWords = ["price", "cost", "margin", "revenue", "sales", "ticket", "profit", "income", "total", "amount"];

    private readonly List<int> _productIds = [];

    protected sealed record TestProduct(int Id, int VariantId, string Sku);

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    public async ValueTask DisposeAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var variantIds = await db.ProductVariants.Where(v => _productIds.Contains(v.ProductId)).Select(v => v.Id).ToListAsync();
        var orderIds = await db.OrderItems.Where(i => variantIds.Contains(i.VariantId)).Select(i => i.OrderId).Distinct().ToListAsync();
        await db.InventoryMovements.Where(m => variantIds.Contains(m.VariantId)).ExecuteDeleteAsync();
        await db.Shipments.Where(s => orderIds.Contains(s.OrderId)).ExecuteDeleteAsync();
        await db.OrderStatusHistory.Where(h => orderIds.Contains(h.OrderId)).ExecuteDeleteAsync();
        await db.OrderItems.Where(i => orderIds.Contains(i.OrderId)).ExecuteDeleteAsync();
        await db.Orders.Where(o => orderIds.Contains(o.Id)).ExecuteDeleteAsync();
        await db.ProductVariants.Where(v => variantIds.Contains(v.Id)).ExecuteDeleteAsync();
        await db.Products.Where(p => _productIds.Contains(p.Id)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    protected async Task<TestProduct> CreateProduct(int stock, decimal price = 100m, decimal? unitCost = null)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var taken = await db.Products.Where(p => p.Line == ProductLine.Accesorios).Select(p => p.PieceNumber).ToListAsync(Ct);
        var piece = Enumerable.Range(400, 500).Select(n => (short)n).First(n => !taken.Contains(n));
        var product = new Product
        {
            Line = ProductLine.Accesorios,
            PieceNumber = piece,
            Slug = $"prueba-{Guid.NewGuid():N}",
            BrandId = CatalogSeed.BrandIds.SinMarca,
            ProductTypeId = CatalogSeed.ProductTypeIds.Lentes,
            Name = "Producto de prueba",
            Material = "Prueba",
            Price = price,
        };
        db.Products.Add(product);
        await db.SaveChangesAsync(Ct);
        _productIds.Add(product.Id);

        var variant = new ProductVariant
        {
            ProductId = product.Id, ColorCode = "NEG", SizeId = CatalogSeed.SizeIds.Unitalla, Sku = $"ACC-{piece:000}-NEG-U", Stock = stock, UnitCost = unitCost,
        };
        db.ProductVariants.Add(variant);
        await db.SaveChangesAsync(Ct);
        db.InventoryMovements.Add(new InventoryMovement
        {
            VariantId = variant.Id, Type = InventoryMovementType.InventarioInicial, Quantity = stock, Balance = stock, CreatedByName = "Prueba",
        });
        await db.SaveChangesAsync(Ct);
        return new TestProduct(product.Id, variant.Id, variant.Sku);
    }

    /// <summary>Compra en la tienda; devuelve el folio.</summary>
    protected async Task<string> Buy(string sku, int quantity = 1, string postalCode = ParcelPostalCode, string payment = "tarjeta", string email = "ana.lopez@correo.test")
    {
        var response = await Post("/api/orders", null, new
        {
            firstName = "Ana", lastName = "López", email, phone = "6681234567",
            street = "Calle 1", neighborhood = "Centro", city = "Los Mochis", state = "Sinaloa", postalCode, references = (string?)null,
            giftWrap = true, paymentMethod = payment, paymentToken = payment == "tarjeta" ? FakePaymentGateway.ApprovedToken : null,
            items = new[] { new { sku, quantity } },
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("folio").GetString()!;
    }

    protected async Task<JsonElement> OrderOf(string folio, string role = Owner) => await Json(await Get($"/api/admin/orders/{folio}", role));

    protected static string VersionOf(JsonElement dto) => dto.GetProperty("rowVersion").GetString()!;

    protected async Task<(int Stock, int Reserved, int LastBalance, InventoryMovementType LastType)> InventoryOf(TestProduct product)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var variant = await db.ProductVariants.AsNoTracking().SingleAsync(v => v.Id == product.VariantId, Ct);
        var last = await db.InventoryMovements.Where(m => m.VariantId == product.VariantId).OrderByDescending(m => m.Id).FirstAsync(Ct);
        return (variant.Stock, variant.Reserved, last.Balance, last.Type);
    }

    protected async Task SetCreatedAt(string folio, DateTime createdAt)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Orders.Where(o => o.Folio == folio).ExecuteUpdateAsync(u => u.SetProperty(o => o.CreatedAt, createdAt), Ct);
    }

    /// <summary>R-24: se revisan las claves, no los valores; un nombre puede contener esas letras sin ser un importe.</summary>
    protected static void AssertNoMoney(JsonElement json)
    {
        var keys = JsonKeys(json).Distinct().ToList();
        Assert.NotEmpty(keys);
        Assert.DoesNotContain(keys, key => MoneyWords.Any(word => key.Contains(word, StringComparison.OrdinalIgnoreCase)));
        // La tarifa cobrada es un importe; `freeShipping` solo dice si fue gratis.
        Assert.DoesNotContain("shipping", keys);
    }

    private static IEnumerable<string> JsonKeys(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => element.EnumerateObject().SelectMany(p => JsonKeys(p.Value).Prepend(p.Name)),
        JsonValueKind.Array => element.EnumerateArray().SelectMany(JsonKeys),
        _ => [],
    };
}
