using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Cupones de punta a punta sobre SQL Server: vista previa, checkout, límites, liberación, panel y reportes (D-40).</summary>
public class CouponsApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string AdminUrl = "/api/admin/coupons";
    private const string PreviewUrl = "/api/coupons/preview";

    private static string NewCode(string prefix = "T") => (prefix + Guid.NewGuid().ToString("N"))[..14].ToUpperInvariant();

    private async Task<JsonElement> CreateCoupon(object body)
    {
        var response = await Post(AdminUrl, Owner, body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var coupon = await Json(response);
        CouponIds.Add(coupon.GetProperty("id").GetInt32());
        return coupon;
    }

    private Task<HttpResponseMessage> Preview(string code, string sku, int quantity = 1, string? postalCode = ParcelPostalCode, string? email = null) =>
        Post(PreviewUrl, null, new { code, items = new[] { new { sku, quantity } }, postalCode, email });

    private Task<HttpResponseMessage> BuyWith(string sku, string? coupon, string email = "ana.lopez@correo.test", int quantity = 1, decimal? expectedTotal = null,
        string payment = "tarjeta", string postalCode = ParcelPostalCode, string? key = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, "/api/orders")
        {
            Content = JsonContent.Create(new
            {
                firstName = "Ana", lastName = "López", email, phone = "6681234567",
                street = "Calle 1", neighborhood = "Centro", city = "Los Mochis", state = "Sinaloa", postalCode, references = (string?)null,
                giftWrap = true, paymentMethod = payment, paymentToken = payment == "tarjeta" ? FakePaymentGateway.ApprovedToken : null,
                expectedTotal, couponCode = coupon, items = new[] { new { sku, quantity } },
            }),
        };
        if (key is not null)
        {
            request.Headers.Add("Idempotency-Key", key);
        }
        return Client.SendAsync(request, Ct);
    }

    private async Task<int> RedemptionsOf(int couponId)
    {
        using var scope = Factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<SokkoDbContext>().CouponRedemptions.CountAsync(r => r.CouponId == couponId, Ct);
    }

    private static decimal D(JsonElement json, string name) => json.GetProperty(name).GetDecimal();

    // --- Permisos ---

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.Forbidden)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Coupons_are_managed_only_by_the_owner(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get(AdminUrl, role)).StatusCode);
        if (role != Owner)
        {
            Assert.Equal(expected, (await Post(AdminUrl, role, new { code = NewCode(), type = "percent", value = 10 })).StatusCode);
        }
    }

    // --- Vista previa ---

    [Fact]
    public async Task Preview_uses_server_prices_and_the_same_formula_as_the_checkout()
    {
        var product = await CreateProduct(5, price: 559m);
        var coupon = await CreateCoupon(new { code = NewCode(), type = "percent", value = 10 });
        var code = coupon.GetProperty("code").GetString()!;

        var response = await Preview(code.ToLowerInvariant(), product.Sku);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var preview = await Json(response);
        Assert.Equal(code, preview.GetProperty("code").GetString());
        Assert.Equal("percent", preview.GetProperty("type").GetString());
        Assert.Equal("10% de descuento", preview.GetProperty("description").GetString());
        Assert.Equal(55.90m, D(preview, "discount"));
        Assert.Equal(99m, D(preview, "shippingCost"));
        Assert.Equal(602.10m, D(preview, "total"));
        Assert.Equal(295.90m, D(preview, "freeShippingRemaining"));

        // El checkout cobra exactamente lo que mostró la vista previa.
        var bought = await BuyWith(product.Sku, code, expectedTotal: 602.10m);
        Assert.Equal(HttpStatusCode.Created, bought.StatusCode);
        var order = await Json(bought);
        Assert.Equal(code, order.GetProperty("couponCode").GetString());
        Assert.Equal(55.90m, D(order, "discountAmount"));
        Assert.Equal(602.10m, D(order, "total"));
        // El IVA incluido sale del total ya con descuento.
        Assert.Equal(Math.Round(602.10m - 602.10m / 1.16m, 2), D(order, "taxIncluded"));
    }

    [Fact]
    public async Task Preview_explains_why_a_code_does_not_apply()
    {
        var product = await CreateProduct(5, price: 100m);
        var minimum = await CreateCoupon(new { code = NewCode(), type = "fixed", value = 50, minSubtotal = 500 });

        var unknown = await Preview("NOEXISTE-123", product.Sku);
        Assert.Equal(HttpStatusCode.UnprocessableEntity, unknown.StatusCode);
        var body = await Json(unknown);
        Assert.Equal("coupon_invalid", body.GetProperty("code").GetString());
        Assert.Equal("not_found", body.GetProperty("reason").GetString());
        Assert.Equal("Este código no existe.", body.GetProperty("message").GetString());

        var low = await Json(await Preview(minimum.GetProperty("code").GetString()!, product.Sku));
        Assert.Equal("min_subtotal", low.GetProperty("reason").GetString());
        Assert.Equal("Este código aplica en compras desde $500.", low.GetProperty("message").GetString());
    }

    [Fact]
    public async Task Free_shipping_coupon_zeroes_shipping()
    {
        var product = await CreateProduct(5, price: 350m);
        var code = (await CreateCoupon(new { code = NewCode(), type = "free_shipping", minSubtotal = 300 })).GetProperty("code").GetString()!;

        foreach (var cp in new[] { LocalPostalCode, ParcelPostalCode })
        {
            var preview = await Json(await Preview(code, product.Sku, postalCode: cp));
            Assert.Equal(0m, D(preview, "shippingCost"));
            Assert.Equal(350m, D(preview, "total"));
        }
    }

    // --- Checkout ---

    [Fact]
    public async Task One_per_customer_is_checked_by_normalized_email()
    {
        var product = await CreateProduct(5, price: 200m);
        var code = (await CreateCoupon(new { code = NewCode(), type = "percent", value = 10, onePerCustomer = true })).GetProperty("code").GetString()!;
        var email = $"Cliente.{Guid.NewGuid():N}@Correo.test";

        Assert.Equal(HttpStatusCode.Created, (await BuyWith(product.Sku, code, email)).StatusCode);

        var preview = await Json(await Preview(code, product.Sku, email: email.ToUpperInvariant()));
        Assert.Equal("already_used", preview.GetProperty("reason").GetString());
        Assert.Equal("Este código ya se usó con su correo.", preview.GetProperty("message").GetString());

        var again = await BuyWith(product.Sku, code, email.ToLowerInvariant());
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        var problem = await Json(again);
        Assert.Equal("coupon_invalid", problem.GetProperty("code").GetString());
        Assert.Equal("already_used", problem.GetProperty("reason").GetString());
        Assert.Equal(299m, D(problem, "total"));

        // Otro correo sí puede usarlo.
        Assert.Equal(HttpStatusCode.Created, (await BuyWith(product.Sku, code, $"otra.{Guid.NewGuid():N}@correo.test")).StatusCode);
    }

    [Fact]
    public async Task Total_limit_holds_under_concurrent_purchases()
    {
        var first = await CreateProduct(5, price: 150m);
        var second = await CreateProduct(5, price: 150m);
        var coupon = await CreateCoupon(new { code = NewCode(), type = "fixed", value = 20, maxRedemptions = 1 });
        var code = coupon.GetProperty("code").GetString()!;

        var responses = await Task.WhenAll(
            BuyWith(first.Sku, code, $"a.{Guid.NewGuid():N}@correo.test"),
            BuyWith(second.Sku, code, $"b.{Guid.NewGuid():N}@correo.test"));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        var rejected = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal("exhausted", (await Json(rejected)).GetProperty("reason").GetString());
        Assert.Equal(1, await RedemptionsOf(coupon.GetProperty("id").GetInt32()));
        // El rechazado no se quedó con piezas apartadas.
        var reserved = new[] { (await InventoryOf(first)).Reserved, (await InventoryOf(second)).Reserved };
        Assert.Equal(1, reserved.Sum());
    }

    [Fact]
    public async Task Coupon_that_expires_between_preview_and_purchase_gets_409_with_the_total_without_it()
    {
        var product = await CreateProduct(5, price: 400m);
        var coupon = await CreateCoupon(new { code = NewCode(), type = "percent", value = 10 });
        var code = coupon.GetProperty("code").GetString()!;
        var shown = D(await Json(await Preview(code, product.Sku)), "total");
        Assert.Equal(459m, shown);

        // El Dueño le pone fin ayer mientras el cliente llena el formulario.
        var yesterday = BusinessTime.DateOf(DateTime.UtcNow).AddDays(-1);
        var put = await Put($"{AdminUrl}/{coupon.GetProperty("id").GetInt32()}", Owner, new
        {
            code, type = "percent", value = 10, startsOn = yesterday.AddDays(-5).ToString("yyyy-MM-dd"), endsOn = yesterday.ToString("yyyy-MM-dd"),
            isActive = true, rowVersion = coupon.GetProperty("rowVersion").GetString(),
        });
        Assert.Equal(HttpStatusCode.OK, put.StatusCode);
        Assert.Equal("expired", (await Json(put)).GetProperty("status").GetString());

        var response = await BuyWith(product.Sku, code, expectedTotal: shown);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await Json(response);
        Assert.Equal("coupon_invalid", problem.GetProperty("code").GetString());
        Assert.Equal("expired", problem.GetProperty("reason").GetString());
        Assert.StartsWith("Este código venció el ", problem.GetProperty("message").GetString());
        Assert.Equal(499m, D(problem, "total"));
        Assert.Equal(0, (await InventoryOf(product)).Reserved);
    }

    [Fact]
    public async Task Cancelling_an_order_frees_its_use_and_keeps_the_history()
    {
        var product = await CreateProduct(5, price: 300m);
        var coupon = await CreateCoupon(new { code = NewCode(), type = "fixed", value = 100, maxRedemptions = 1 });
        var code = coupon.GetProperty("code").GetString()!;
        var folio = (await Json(await BuyWith(product.Sku, code))).GetProperty("folio").GetString()!;
        Assert.Equal("exhausted", (await Json(await Preview(code, product.Sku))).GetProperty("reason").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/admin/orders/{folio}/cancel", Owner, new { rowVersion = VersionOf(await OrderOf(folio)) })).StatusCode);

        var cancelled = await OrderOf(folio);
        Assert.Equal(code, cancelled.GetProperty("couponCode").GetString());
        Assert.Equal(100m, D(cancelled, "discountAmount"));
        Assert.Equal(0, await RedemptionsOf(coupon.GetProperty("id").GetInt32()));
        Assert.Equal(HttpStatusCode.Created, (await BuyWith(product.Sku, code)).StatusCode);
    }

    [Fact]
    public async Task Expired_oxxo_reference_frees_the_use()
    {
        var product = await CreateProduct(5, price: 300m);
        var coupon = await CreateCoupon(new { code = NewCode(), type = "percent", value = 10, maxRedemptions = 1 });
        var code = coupon.GetProperty("code").GetString()!;
        var folio = (await Json(await BuyWith(product.Sku, code, payment: "oxxo_pay"))).GetProperty("folio").GetString()!;
        Assert.Equal(1, await RedemptionsOf(coupon.GetProperty("id").GetInt32()));

        await SetCreatedAt(folio, DateTime.UtcNow.AddHours(-100));
        using (var scope = Factory.Services.CreateScope())
        {
            await scope.ServiceProvider.GetRequiredService<IExpireOxxoOrders>().RunAsync(Ct);
        }

        Assert.Equal("cancelado", (await OrderOf(folio)).GetProperty("status").GetString());
        Assert.Equal(0, await RedemptionsOf(coupon.GetProperty("id").GetInt32()));
    }

    [Fact]
    public async Task Idempotent_replay_includes_the_coupon()
    {
        var product = await CreateProduct(5, price: 300m);
        var code = (await CreateCoupon(new { code = NewCode(), type = "percent", value = 10 })).GetProperty("code").GetString()!;
        var key = Guid.NewGuid().ToString("N");

        var first = await BuyWith(product.Sku, code, key: key);
        var replay = await BuyWith(product.Sku, code.ToLowerInvariant(), key: key);
        var other = await BuyWith(product.Sku, null, key: key);

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, replay.StatusCode);
        Assert.Equal("true", replay.Headers.GetValues("Idempotency-Replayed").Single());
        Assert.Equal((await Json(first)).GetProperty("folio").GetString(), (await Json(replay)).GetProperty("folio").GetString());
        Assert.Equal(HttpStatusCode.UnprocessableEntity, other.StatusCode);
    }

    // --- Panel ---

    [Fact]
    public async Task Operations_sees_the_coupon_code_but_not_the_amount()
    {
        var product = await CreateProduct(5, price: 300m);
        var code = (await CreateCoupon(new { code = NewCode(), type = "fixed", value = 50 })).GetProperty("code").GetString()!;
        var folio = (await Json(await BuyWith(product.Sku, code))).GetProperty("folio").GetString()!;

        var operations = await OrderOf(folio, Operations);
        Assert.Equal(code, operations.GetProperty("couponCode").GetString());
        AssertNoMoney(operations);
        Assert.False(operations.TryGetProperty("discountAmount", out _));

        var owner = await OrderOf(folio);
        Assert.Equal(50m, D(owner, "discountAmount"));
    }

    [Fact]
    public async Task Owner_creates_edits_toggles_and_deletes_coupons()
    {
        var code = NewCode();
        var created = await CreateCoupon(new { code = $" {code.ToLowerInvariant()} ", description = "Lanzamiento", type = "percent", value = 15, maxRedemptions = 50 });
        Assert.Equal(code, created.GetProperty("code").GetString());
        Assert.Equal("active", created.GetProperty("status").GetString());
        Assert.True(created.GetProperty("canDelete").GetBoolean());
        var id = created.GetProperty("id").GetInt32();

        var duplicate = await Post(AdminUrl, Owner, new { code, type = "fixed", value = 10 });
        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        Assert.Equal(CouponService.CodeTaken, (await Json(duplicate)).GetProperty("errors").GetProperty("code")[0].GetString());

        var invalid = await Post(AdminUrl, Owner, new { code = NewCode(), type = "percent", value = 95 });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.True((await Json(invalid)).GetProperty("errors").TryGetProperty("value", out _));

        Assert.Equal(HttpStatusCode.BadRequest, (await Put($"{AdminUrl}/{id}", Owner, new { code, type = "percent", value = 15 })).StatusCode);

        var off = await Json(await Post($"{AdminUrl}/{id}/deactivate", Owner, new { }));
        Assert.Equal("inactive", off.GetProperty("status").GetString());
        var on = await Json(await Post($"{AdminUrl}/{id}/activate", Owner, new { }));
        Assert.Equal("active", on.GetProperty("status").GetString());

        // Con un pedido ya no se borra, y la lista suma usos, descuento y ventas.
        var product = await CreateProduct(5, price: 200m);
        var order = await Json(await BuyWith(product.Sku, code));
        var listed = (await Json(await Get(AdminUrl, Owner))).EnumerateArray().Single(c => c.GetProperty("id").GetInt32() == id);
        Assert.Equal(1, listed.GetProperty("redemptions").GetInt32());
        Assert.Equal(30m, D(listed, "discountGiven"));
        Assert.Equal(D(order, "total"), D(listed, "sales"));
        Assert.False(listed.GetProperty("canDelete").GetBoolean());
        Assert.Equal(HttpStatusCode.Conflict, (await Delete($"{AdminUrl}/{id}", Owner)).StatusCode);

        var unused = await CreateCoupon(new { code = NewCode(), type = "free_shipping" });
        Assert.Equal(HttpStatusCode.NoContent, (await Delete($"{AdminUrl}/{unused.GetProperty("id").GetInt32()}", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{AdminUrl}/{unused.GetProperty("id").GetInt32()}", Owner)).StatusCode);
    }

    // --- Reportes ---

    [Fact]
    public async Task Reports_show_discounts_and_sales_stay_net_like_the_dashboard()
    {
        var quiet = new DateOnly(2019, 4, 13);
        var product = await CreateProduct(5, price: 500m);
        var code = (await CreateCoupon(new { code = NewCode(), type = "fixed", value = 120 })).GetProperty("code").GetString()!;
        var url = $"/api/admin/reports/sales?from={quiet:yyyy-MM-dd}&to={quiet:yyyy-MM-dd}";
        var before = (await Json(await Get(url, Owner))).GetProperty("kpis");

        var order = await Json(await BuyWith(product.Sku, code));
        var folio = order.GetProperty("folio").GetString()!;
        await SetCreatedAt(folio, BusinessTime.NoonUtc(quiet));
        var after = (await Json(await Get(url, Owner))).GetProperty("kpis");

        decimal Delta(string kpi) => after.GetProperty(kpi).GetProperty("value").GetDecimal() - before.GetProperty(kpi).GetProperty("value").GetDecimal();
        Assert.Equal(120m, Delta("discounts"));
        Assert.Equal(D(order, "total"), Delta("sales"));
        Assert.Equal(479m, D(order, "total"));

        var csv = Encoding.UTF8.GetString(await (await Get($"/api/admin/reports/sales.csv?from={quiet:yyyy-MM-dd}&to={quiet:yyyy-MM-dd}", Owner)).Content.ReadAsByteArrayAsync(Ct));
        Assert.Contains($",500.00,{code},120.00,99.00,", csv.Split("\r\n").Single(l => l.StartsWith(folio + ",", StringComparison.Ordinal)));

        // Dashboard = Reportes también con descuentos (ventas = total cobrado).
        await SetCreatedAt(folio, DateTime.UtcNow);
        var today = BusinessTime.DateOf(DateTime.UtcNow);
        var dashboard = (await Json(await Get("/api/admin/dashboard?range=hoy", Owner))).GetProperty("kpis");
        var report = (await Json(await Get($"/api/admin/reports/sales?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}", Owner))).GetProperty("kpis");
        Assert.Equal(dashboard.GetProperty("sales").GetProperty("value").GetDecimal(), report.GetProperty("sales").GetProperty("value").GetDecimal());
    }
}
