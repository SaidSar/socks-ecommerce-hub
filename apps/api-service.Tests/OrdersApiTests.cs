using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Hora real más un desplazamiento, para adelantar el vencimiento de OXXO sin esperar.</summary>
internal sealed class ShiftedClock : IClock
{
    public TimeSpan Offset { get; set; }
    public DateTime UtcNow => DateTime.UtcNow + Offset;
    public DateOnly Today => DateOnly.FromDateTime(UtcNow);
}

public sealed class OrdersApiFactory : WebApplicationFactory<Program>
{
    internal ShiftedClock Clock { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("RateLimiting:AuthPermitLimit", "10000");
        builder.UseSetting("Orders:OxxoExpiryJobEnabled", "false");
        builder.ConfigureTestServices(services => services.Replace(ServiceDescriptor.Singleton<IClock>(Clock)));
    }
}

/// <summary>Compra real contra la BD, con productos desechables para no tocar el stock de la semilla.</summary>
public class OrdersApiTests(OrdersApiFactory factory) : IClassFixture<OrdersApiFactory>, IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly List<int> _productIds = [];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed record TestProduct(int VariantId, string Sku, decimal Price);

    public ValueTask InitializeAsync()
    {
        factory.Clock.Offset = TimeSpan.Zero;
        return ValueTask.CompletedTask;
    }

    /// <summary>Borra todo lo que crearon las pruebas de esta clase.</summary>
    public async ValueTask DisposeAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var variantIds = await db.ProductVariants.Where(v => _productIds.Contains(v.ProductId)).Select(v => v.Id).ToListAsync();
        var orderIds = await db.OrderItems.Where(i => variantIds.Contains(i.VariantId)).Select(i => i.OrderId).Distinct().ToListAsync();
        await db.OrderStatusHistory.Where(h => orderIds.Contains(h.OrderId)).ExecuteDeleteAsync();
        await db.OrderItems.Where(i => orderIds.Contains(i.OrderId)).ExecuteDeleteAsync();
        await db.Orders.Where(o => orderIds.Contains(o.Id)).ExecuteDeleteAsync();
        await db.InventoryMovements.Where(m => variantIds.Contains(m.VariantId)).ExecuteDeleteAsync();
        await db.ProductVariants.Where(v => variantIds.Contains(v.Id)).ExecuteDeleteAsync();
        await db.Products.Where(p => _productIds.Contains(p.Id)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private async Task<TestProduct> CreateProduct(int stock, decimal price = 100m, int? collectionId = null)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var piece = (short)Random.Shared.Next(400, 999);
        var product = new Product
        {
            Line = ProductLine.Accesorios,
            PieceNumber = piece,
            Slug = $"prueba-{Guid.NewGuid():N}",
            BrandId = CatalogSeed.BrandIds.SinMarca,
            ProductTypeId = CatalogSeed.ProductTypeIds.Lentes,
            CollectionId = collectionId,
            Name = "Producto de prueba",
            Material = "Prueba",
            Price = price,
        };
        db.Products.Add(product);
        await db.SaveChangesAsync(Ct);
        _productIds.Add(product.Id);

        var variant = new ProductVariant
        {
            ProductId = product.Id, ColorCode = "NEG", SizeId = CatalogSeed.SizeIds.Unitalla, Sku = $"ACC-{piece:000}-NEG-U", Stock = stock,
        };
        db.ProductVariants.Add(variant);
        await db.SaveChangesAsync(Ct);
        db.InventoryMovements.Add(new InventoryMovement
        {
            VariantId = variant.Id, Type = InventoryMovementType.InventarioInicial, Quantity = stock, Balance = stock, CreatedByName = "Prueba",
        });
        await db.SaveChangesAsync(Ct);
        return new TestProduct(variant.Id, variant.Sku, price);
    }

    private static object Body(string sku, int quantity = 1, string payment = "tarjeta", string? token = FakePaymentGateway.ApprovedToken,
        string postalCode = "06700", string email = "ana@correo.test", decimal? expectedTotal = null) => new
    {
        firstName = "Ana", lastName = "López", email, phone = "6681234567",
        street = "Calle 1", neighborhood = "Centro", city = "Los Mochis", state = "Sinaloa", postalCode, references = (string?)null,
        giftWrap = true, paymentMethod = payment, paymentToken = token, expectedTotal,
        items = new[] { new { sku, quantity } },
        // Lo que un cliente malicioso podría mandar: el servidor lo ignora.
        price = 1, total = 1, subtotal = 1,
    };

    private async Task<HttpResponseMessage> Post(object body, string? key = null, string? bearer = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders") { Content = JsonContent.Create(body) };
        if (key is not null)
        {
            request.Headers.Add("Idempotency-Key", key);
        }
        if (bearer is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
        }
        return await _client.SendAsync(request, Ct);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

    private async Task<(int Stock, int Reserved, int LastBalance)> InventoryOf(int variantId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var variant = await db.ProductVariants.AsNoTracking().SingleAsync(v => v.Id == variantId, Ct);
        var balance = await db.InventoryMovements.Where(m => m.VariantId == variantId).OrderByDescending(m => m.Id).Select(m => m.Balance).FirstAsync(Ct);
        return (variant.Stock, variant.Reserved, balance);
    }

    private async Task<int> OrderCount(int variantId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        return await db.OrderItems.CountAsync(i => i.VariantId == variantId, Ct);
    }

    private async Task<string> TokenFor(string email, string password)
    {
        var response = await _client.PostAsJsonAsync("/api/auth/login", new { email, password }, Ct);
        return (await Json(response)).GetProperty("accessToken").GetString()!;
    }

    [Fact]
    public async Task Card_order_returns_201_with_server_prices_and_reserves()
    {
        var product = await CreateProduct(stock: 5, price: 100m);

        var response = await Post(Body(product.Sku, quantity: 2));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.NotNull(response.Headers.Location);
        var order = await Json(response);
        Assert.StartsWith("SKK-", order.GetProperty("folio").GetString());
        Assert.Equal("pagado", order.GetProperty("paymentStatus").GetString());
        Assert.Equal("tarjeta", order.GetProperty("paymentMethod").GetString());
        Assert.Equal("por_preparar", order.GetProperty("status").GetString());
        Assert.Equal("paqueteria", order.GetProperty("deliveryMethod").GetString());
        Assert.Equal(200m, order.GetProperty("subtotal").GetDecimal());
        Assert.Equal(99m, order.GetProperty("shippingCost").GetDecimal());
        Assert.Equal(299m, order.GetProperty("total").GetDecimal());
        Assert.Equal(41.24m, order.GetProperty("taxIncluded").GetDecimal());
        Assert.Equal(100m, order.GetProperty("items")[0].GetProperty("unitPrice").GetDecimal());
        Assert.Equal("pagado", order.GetProperty("timeline")[0].GetProperty("status").GetString());
        Assert.False(order.TryGetProperty("internalNote", out _));
        Assert.Equal((5, 2, 5), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Off_season_price_is_applied_by_the_server()
    {
        factory.Clock.Offset = new DateTime(2027, 3, 20, 19, 0, 0, DateTimeKind.Utc) - DateTime.UtcNow;
        var product = await CreateProduct(stock: 1, price: 199m, collectionId: CatalogSeed.CollectionIds.Navidad);

        var order = await Json(await Post(Body(product.Sku)));

        Assert.Equal(139.30m, order.GetProperty("items")[0].GetProperty("unitPrice").GetDecimal());
    }

    [Theory]
    [InlineData("81250", 49)]
    [InlineData("06700", 99)]
    public async Task Delivery_is_quoted_by_postal_code(string postalCode, int cost)
    {
        var product = await CreateProduct(stock: 1);

        var order = await Json(await Post(Body(product.Sku, postalCode: postalCode)));

        Assert.Equal(cost, order.GetProperty("shippingCost").GetDecimal());
    }

    [Fact]
    public async Task Validation_errors_return_400()
    {
        var product = await CreateProduct(stock: 1);

        var badCp = await Post(Body(product.Sku, postalCode: "123"));
        Assert.Equal(HttpStatusCode.BadRequest, badCp.StatusCode);
        Assert.True((await Json(badCp)).GetProperty("errors").TryGetProperty("PostalCode", out _));

        var noToken = await Post(Body(product.Sku, token: null));
        Assert.Equal(HttpStatusCode.BadRequest, noToken.StatusCode);
        Assert.True((await Json(noToken)).GetProperty("errors").TryGetProperty("PaymentToken", out _));

        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Body(product.Sku, quantity: 0))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Body(product.Sku, payment: "efectivo"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post(Body(product.Sku), key: new string('k', 65))).StatusCode);
        Assert.Equal((1, 0, 1), await InventoryOf(product.VariantId));
    }

    [Theory]
    [InlineData(FakePaymentGateway.DeclinedToken, "declined")]
    [InlineData(FakePaymentGateway.InsufficientFundsToken, "insufficient_funds")]
    public async Task Declined_card_returns_402_and_leaves_nothing_behind(string token, string code)
    {
        var product = await CreateProduct(stock: 3);

        var response = await Post(Body(product.Sku, token: token));

        Assert.Equal(HttpStatusCode.PaymentRequired, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(code, (await Json(response)).GetProperty("declineCode").GetString());
        Assert.Equal((3, 0, 3), await InventoryOf(product.VariantId));
        Assert.Equal(0, await OrderCount(product.VariantId));
    }

    [Fact]
    public async Task No_stock_returns_409_by_line()
    {
        var product = await CreateProduct(stock: 1);

        var response = await Post(new
        {
            firstName = "Ana", lastName = "López", email = "ana@correo.test", phone = "6681234567",
            street = "Calle 1", neighborhood = "Centro", city = "Los Mochis", state = "Sinaloa", postalCode = "06700",
            paymentMethod = "tarjeta", paymentToken = FakePaymentGateway.ApprovedToken,
            items = new[] { new { sku = product.Sku, quantity = 2 }, new { sku = "ACC-000-NEG-U", quantity = 1 } },
        });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await Json(response);
        Assert.Equal("out_of_stock", problem.GetProperty("code").GetString());
        var lines = problem.GetProperty("lines").EnumerateArray().ToList();
        Assert.Equal(2, lines.Count);
        var line = lines.Single(l => l.GetProperty("sku").GetString() == product.Sku);
        Assert.Equal(2, line.GetProperty("requested").GetInt32());
        Assert.Equal(1, line.GetProperty("available").GetInt32());
        Assert.Equal((1, 0, 1), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Different_expected_total_returns_409_without_charging()
    {
        var product = await CreateProduct(stock: 1, price: 100m);

        var response = await Post(Body(product.Sku, expectedTotal: 1m));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await Json(response);
        Assert.Equal("price_changed", problem.GetProperty("code").GetString());
        Assert.Equal(199m, problem.GetProperty("total").GetDecimal());
        Assert.Equal((1, 0, 1), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Concurrent_checkouts_for_the_last_unit_have_one_winner()
    {
        var product = await CreateProduct(stock: 1);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(i => Post(Body(product.Sku, email: $"c{i}@correo.test"))));

        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(7, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        // R-19: apartar no toca el stock ni el kárdex, y Reserved nunca pasa de Stock.
        Assert.Equal((1, 1, 1), await InventoryOf(product.VariantId));
        Assert.Equal(1, await OrderCount(product.VariantId));
    }

    [Fact]
    public async Task Same_key_creates_one_order_even_with_a_double_click()
    {
        var product = await CreateProduct(stock: 5);
        var key = Guid.NewGuid().ToString("N");
        var body = Body(product.Sku);

        var responses = await Task.WhenAll(Enumerable.Range(0, 5).Select(_ => Post(body, key)));

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
        var folios = await Task.WhenAll(responses.Select(async r => (await Json(r)).GetProperty("folio").GetString()));
        Assert.Single(folios.Distinct());
        Assert.Equal(4, responses.Count(r => r.Headers.Contains("Idempotency-Replayed")));
        Assert.Equal((5, 1, 5), await InventoryOf(product.VariantId));
        Assert.Equal(1, await OrderCount(product.VariantId));
    }

    [Fact]
    public async Task Same_key_with_other_data_returns_422()
    {
        var product = await CreateProduct(stock: 5);
        var key = Guid.NewGuid().ToString("N");

        Assert.Equal(HttpStatusCode.Created, (await Post(Body(product.Sku), key)).StatusCode);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, (await Post(Body(product.Sku, quantity: 2), key)).StatusCode);
        Assert.Equal((5, 1, 5), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Declined_card_can_retry_with_the_same_key()
    {
        var product = await CreateProduct(stock: 1);
        var key = Guid.NewGuid().ToString("N");

        Assert.Equal(HttpStatusCode.PaymentRequired, (await Post(Body(product.Sku, token: FakePaymentGateway.DeclinedToken), key)).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await Post(Body(product.Sku), key)).StatusCode);
    }

    [Fact]
    public async Task Oxxo_stays_pending_expires_after_72_hours_and_releases_stock()
    {
        var product = await CreateProduct(stock: 2);
        var created = await Json(await Post(Body(product.Sku, payment: "oxxo_pay", token: null)));
        var folio = created.GetProperty("folio").GetString()!;

        Assert.Equal("pendiente", created.GetProperty("paymentStatus").GetString());
        Assert.Matches("^93[0-9]{12}$", created.GetProperty("paymentReference").GetString()!);
        Assert.Equal(72, Math.Round((created.GetProperty("oxxoExpiresAt").GetDateTime() - created.GetProperty("createdAt").GetDateTime()).TotalHours));
        Assert.Equal((2, 1, 2), await InventoryOf(product.VariantId));

        factory.Clock.Offset = TimeSpan.FromHours(71);
        await RunExpiry();
        Assert.Equal((2, 1, 2), await InventoryOf(product.VariantId));

        factory.Clock.Offset = TimeSpan.FromHours(73);
        await RunExpiry();
        Assert.Equal((2, 0, 2), await InventoryOf(product.VariantId));

        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/orders/{folio}");
        request.Headers.Add("X-Customer-Email", "ana@correo.test");
        var order = await Json(await _client.SendAsync(request, Ct));
        Assert.Equal("cancelado", order.GetProperty("status").GetString());
        Assert.Equal(JsonValueKind.Null, order.GetProperty("oxxoExpiresAt").ValueKind);

        // Correr otra vez no libera dos veces.
        await RunExpiry();
        Assert.Equal((2, 0, 2), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Paid_oxxo_never_expires()
    {
        var product = await CreateProduct(stock: 2);
        var folio = (await Json(await Post(Body(product.Sku, payment: "oxxo_pay", token: null)))).GetProperty("folio").GetString();

        using var pay = new HttpRequestMessage(HttpMethod.Post, $"/api/orders/{folio}/oxxo/simulate-payment");
        pay.Headers.Add("X-Customer-Email", "ana@correo.test");
        var paid = await _client.SendAsync(pay, Ct);
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);
        var order = await Json(paid);
        Assert.Equal("pagado", order.GetProperty("paymentStatus").GetString());
        Assert.Equal(JsonValueKind.Null, order.GetProperty("oxxoExpiresAt").ValueKind);
        Assert.Equal(["por_preparar", "pagado"], order.GetProperty("timeline").EnumerateArray().Select(t => t.GetProperty("status").GetString()));

        factory.Clock.Offset = TimeSpan.FromHours(100);
        await RunExpiry();
        Assert.Equal((2, 1, 2), await InventoryOf(product.VariantId));

        using var again = new HttpRequestMessage(HttpMethod.Post, $"/api/orders/{folio}/oxxo/simulate-payment");
        again.Headers.Add("X-Customer-Email", "ana@correo.test");
        Assert.Equal(HttpStatusCode.Conflict, (await _client.SendAsync(again, Ct)).StatusCode);
    }

    private async Task RunExpiry()
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IExpireOxxoOrders>().RunAsync(Ct);
    }

    [Fact]
    public async Task Guest_reads_an_order_only_with_its_email()
    {
        var product = await CreateProduct(stock: 1);
        var folio = (await Json(await Post(Body(product.Sku)))).GetProperty("folio").GetString();

        async Task<HttpStatusCode> Read(string? email)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/orders/{folio}");
            if (email is not null)
            {
                request.Headers.Add("X-Customer-Email", email);
            }
            return (await _client.SendAsync(request, Ct)).StatusCode;
        }

        Assert.Equal(HttpStatusCode.OK, await Read(" ANA@correo.test "));
        Assert.Equal(HttpStatusCode.NotFound, await Read("otra@correo.test"));
        Assert.Equal(HttpStatusCode.NotFound, await Read(null));
    }

    [Fact]
    public async Task Customer_order_belongs_to_its_owner_and_appears_in_mine()
    {
        var product = await CreateProduct(stock: 2);
        var nexus = await TokenFor("nexus@sokko.mx", "NexusCode2026");
        var daniel = await TokenFor("daniel@sokko.mx", "Operaciones2026");
        var folio = (await Json(await Post(Body(product.Sku, email: "nexus@sokko.mx"), bearer: nexus))).GetProperty("folio").GetString();

        async Task<HttpResponseMessage> Get(string url, string? bearer, string? email = null)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, url);
            if (bearer is not null)
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearer);
            }
            if (email is not null)
            {
                request.Headers.Add("X-Customer-Email", email);
            }
            return await _client.SendAsync(request, Ct);
        }

        Assert.Equal(HttpStatusCode.OK, (await Get($"/api/orders/{folio}", nexus)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/orders/{folio}", daniel)).StatusCode);
        // El correo no abre el pedido de una cuenta.
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"/api/orders/{folio}", null, "nexus@sokko.mx")).StatusCode);

        var mine = await Json(await Get("/api/orders/mine", nexus));
        Assert.Contains(folio, mine.EnumerateArray().Select(o => o.GetProperty("folio").GetString()));
        var others = await Json(await Get("/api/orders/mine", daniel));
        Assert.DoesNotContain(folio, others.EnumerateArray().Select(o => o.GetProperty("folio").GetString()));
        Assert.Equal(HttpStatusCode.Unauthorized, (await Get("/api/orders/mine", null)).StatusCode);
    }

    [Fact]
    public async Task Invalid_bearer_does_not_buy_as_a_guest()
    {
        var product = await CreateProduct(stock: 1);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Post(Body(product.Sku), bearer: "no-es-un-token")).StatusCode);
        Assert.Equal((1, 0, 1), await InventoryOf(product.VariantId));
    }

    [Fact]
    public async Task Simulated_payment_does_not_exist_outside_development()
    {
        var production = factory.WithWebHostBuilder(b =>
        {
            b.UseEnvironment("Production");
            b.UseSetting("Jwt:SigningKey", new string('k', 40));
            b.UseSetting("Frontend:WebStoreUrl", "http://tienda.test");
            b.UseSetting("Email:Provider", EmailSetup.AzureProvider);
            b.UseSetting("Email:ConnectionString", "endpoint=https://prueba.communication.azure.com/;accesskey=a2V5");
            b.UseSetting("Email:SenderAddress", "DoNotReply@prueba.azurecomm.net");
            // No llega a conectarse: la ruta responde antes de tocar la BD.
            b.UseSetting("ConnectionStrings:Sokko", "Server=localhost;Database=SinUso;Trusted_Connection=True;TrustServerCertificate=True");
        });

        var response = await production.CreateClient().PostAsync("/api/orders/SKK-1/oxxo/simulate-payment", null, Ct);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
