using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;

namespace Sokko.Api.Tests;

public class AdminCustomersApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Url = "/api/admin/customers";

    private static readonly string[] SensitiveKeys = ["passwordHash", "password", "token", "resetToken", "ipAddress", "ip"];

    private readonly string _token = Guid.NewGuid().ToString("N")[..10];

    private string Email(string who) => $"{who}-{_token}@correo.test";

    private async Task<List<JsonElement>> Rows(string query) =>
        (await Json(await Get($"{Url}?{query}", Owner))).GetProperty("customers").EnumerateArray().ToList();

    private async Task UpdateOrder(string folio, string? email = null, string? firstName = null)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        if (email is not null)
        {
            await db.Orders.Where(o => o.Folio == folio).ExecuteUpdateAsync(u => u.SetProperty(o => o.CustomerEmail, email), Ct);
        }
        if (firstName is not null)
        {
            await db.Orders.Where(o => o.Folio == folio).ExecuteUpdateAsync(u => u.SetProperty(o => o.CustomerFirstName, firstName), Ct);
        }
    }

    private static List<string> KeysOf(JsonElement element) => element.ValueKind switch
    {
        JsonValueKind.Object => element.EnumerateObject().SelectMany(p => KeysOf(p.Value).Prepend(p.Name)).ToList(),
        JsonValueKind.Array => element.EnumerateArray().SelectMany(KeysOf).ToList(),
        _ => [],
    };

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.Forbidden)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Customers_are_only_for_the_owner(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get(Url, role)).StatusCode);
        Assert.Equal(expected, (await Get($"{Url}/export.csv", role)).StatusCode);
        Assert.Equal(expected, (await Get($"{Url}/marketing.csv", role)).StatusCode);
    }

    [Fact]
    public async Task Operations_cannot_open_a_detail() =>
        Assert.Equal(HttpStatusCode.Forbidden, (await Get($"{Url}/guest?email=ana@correo.test", Operations)).StatusCode);

    [Theory]
    [InlineData("type=nuevos")]
    [InlineData("sort=nombre")]
    public async Task Unknown_filter_or_sort_gets_400(string query) =>
        Assert.Equal(HttpStatusCode.BadRequest, (await Get($"{Url}?{query}", Owner)).StatusCode);

    [Fact]
    public async Task Guests_are_grouped_by_email_ignoring_case()
    {
        var product = await CreateProduct(5);
        await Buy(product.Sku, email: Email("ana"));
        var second = await Buy(product.Sku, email: Email("ana"));
        await UpdateOrder(second, email: Email("ana").ToUpperInvariant());

        var rows = await Rows($"type=invitados&q={_token}");

        var ana = Assert.Single(rows);
        Assert.Equal("invitado", ana.GetProperty("kind").GetString());
        Assert.Equal(Email("ana"), ana.GetProperty("email").GetString());
        Assert.Equal(2, ana.GetProperty("orders").GetInt32());
        Assert.Equal(JsonValueKind.Null, ana.GetProperty("id").ValueKind);
        Assert.Empty(await Rows($"type=cuenta&q={_token}"));
    }

    [Fact]
    public async Task Totals_leave_out_cancelled_and_unpaid_orders()
    {
        var product = await CreateProduct(5, price: 100m);
        await Buy(product.Sku, email: Email("ana"));
        await Buy(product.Sku, email: Email("ana"), payment: "oxxo_pay");
        var cancelled = await Buy(product.Sku, email: Email("ana"));
        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/admin/orders/{cancelled}/cancel", Owner, new { rowVersion = VersionOf(await OrderOf(cancelled)) })).StatusCode);

        var ana = Assert.Single(await Rows($"q={_token}"));

        // Cuentan la de tarjeta y el OXXO pendiente; gastado solo es lo pagado: 100 + 99 de envío.
        Assert.Equal(2, ana.GetProperty("orders").GetInt32());
        Assert.Equal(199m, ana.GetProperty("spent").GetDecimal());
    }

    [Fact]
    public async Task Search_by_name_ignores_accents_and_case()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, email: Email("x"));
        await UpdateOrder(folio, firstName: $"Ñandú{_token}");

        Assert.Single(await Rows($"q=nandu{_token.ToUpperInvariant()}"));
        Assert.Single(await Rows($"q={Uri.EscapeDataString(Email("x"))}"));
        Assert.Empty(await Rows($"q=nadie-{_token}"));
    }

    [Fact]
    public async Task Sorts_by_total_orders_and_last_purchase()
    {
        var product = await CreateProduct(10, price: 100m);
        await Buy(product.Sku, 3, email: Email("mucho"));
        var early = await Buy(product.Sku, email: Email("poco"));
        await Buy(product.Sku, email: Email("poco"));
        var old = await Buy(product.Sku, email: Email("viejo"));
        await SetCreatedAt(old, new DateTime(2020, 1, 1, 19, 0, 0, DateTimeKind.Utc));
        await SetCreatedAt(early, new DateTime(2020, 1, 2, 19, 0, 0, DateTimeKind.Utc));

        async Task<List<string>> Order(string sort) => (await Rows($"q={_token}&sort={sort}")).Select(r => r.GetProperty("email").GetString()!.Split('-')[0]).ToList();

        Assert.Equal(["mucho", "poco", "viejo"], await Order("total"));
        Assert.Equal("poco", (await Order("pedidos"))[0]);
        Assert.Equal("viejo", (await Order("ultima_compra"))[^1]);
        Assert.Equal("viejo", (await Order("alta"))[^1]);
    }

    [Fact]
    public async Task Guest_detail_has_orders_and_last_address()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, email: Email("ana"));

        var response = await Get($"{Url}/guest?email={Uri.EscapeDataString(Email("ana").ToUpperInvariant())}", Owner);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await Json(response);
        Assert.Equal(folio, detail.GetProperty("orders")[0].GetProperty("folio").GetString());
        Assert.Equal("Los Mochis", detail.GetProperty("lastAddress").GetProperty("city").GetString());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("favorites").ValueKind);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/guest?email=nadie-{_token}@correo.test", Owner)).StatusCode);
    }

    [Fact]
    public async Task Account_detail_has_favorites_and_no_sensitive_data()
    {
        var nexus = Assert.Single(await Rows("type=cuenta&q=nexus@sokko.mx"));
        Assert.Equal("cuenta", nexus.GetProperty("kind").GetString());
        var id = nexus.GetProperty("id").GetInt32();

        var response = await Get($"{Url}/{id}", Owner);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detail = await Json(response);
        Assert.Equal(JsonValueKind.Number, detail.GetProperty("favorites").ValueKind);
        var keys = KeysOf(detail);
        Assert.DoesNotContain(keys, k => SensitiveKeys.Contains(k, StringComparer.OrdinalIgnoreCase));
        Assert.DoesNotContain("AQAAAA", await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/999999", Owner)).StatusCode);

        // Una cuenta del equipo no es cliente.
        var staff = await Rows("q=hola@sokko.mx");
        Assert.Empty(staff);
    }

    [Fact]
    public async Task Csv_exports_respect_the_filter_and_the_marketing_consent()
    {
        var product = await CreateProduct(5);
        await Buy(product.Sku, email: Email("ana"));

        var export = await Get($"{Url}/export.csv?q={_token}", Owner);
        var bytes = await export.Content.ReadAsByteArrayAsync(Ct);
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes[..3]);
        var lines = Encoding.UTF8.GetString(bytes[3..]).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length);
        Assert.Contains(Email("ana"), lines[1]);
        Assert.Contains(",Invitado,", lines[1]);

        var marketing = Encoding.UTF8.GetString(await (await Get($"{Url}/marketing.csv", Owner)).Content.ReadAsByteArrayAsync(Ct));
        Assert.StartsWith("﻿Nombre,Correo,Talla preferida,Cliente desde\r\n", marketing);
        Assert.DoesNotContain(Email("ana"), marketing);
    }
}
