using System.Net;
using System.Text.Json;
using Sokko.Api.DTOs;

namespace Sokko.Api.Tests;

public class AdminDashboardApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Url = "/api/admin/dashboard";

    private async Task<JsonElement> Dashboard(string range = "hoy", string role = Owner) => await Json(await Get($"{Url}?range={range}", role));

    private static JsonElement LineOf(JsonElement dashboard, string line) =>
        dashboard.GetProperty("catalog").GetProperty("lines").EnumerateArray().Single(l => l.GetProperty("line").GetString() == line);

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.OK)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Dashboard_is_for_staff(string? role, HttpStatusCode expected) =>
        Assert.Equal(expected, (await Get(Url, role)).StatusCode);

    [Fact]
    public async Task Unknown_range_gets_400() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await Get($"{Url}?range=90d", Owner)).StatusCode);

    [Theory]
    [InlineData("hoy")]
    [InlineData("7d")]
    [InlineData("30d")]
    public async Task Operations_dashboard_has_no_money_in_any_range(string range)
    {
        var product = await CreateProduct(5, unitCost: 40m);
        await Buy(product.Sku);

        var ops = await Dashboard(range, Operations);

        AssertNoMoney(ops);
        Assert.False(ops.TryGetProperty("daily", out _));
        Assert.False(ops.GetProperty("kpis").TryGetProperty("sales", out _));
        Assert.False(ops.GetProperty("kpis").TryGetProperty("ticket", out _));
        Assert.False(ops.GetProperty("catalog").TryGetProperty("grossMargin", out _));
        Assert.False(ops.GetProperty("catalog").TryGetProperty("brands", out _));
        Assert.Equal(["line", "units"], LineOf(ops, "accesorios").EnumerateObject().Select(p => p.Name));
        Assert.True(ops.GetProperty("kpis").GetProperty("orders").GetProperty("value").GetInt32() >= 1);
    }

    [Theory]
    [InlineData(typeof(OperationsDashboardDto))]
    public void Operations_dashboard_type_has_no_decimal(Type type) =>
        Assert.Empty(AdminOrdersApiTests.DecimalProperties(type, []));

    [Fact]
    public async Task Owner_sees_sales_ticket_and_margin_by_line()
    {
        var before = await Dashboard();
        var product = await CreateProduct(5, price: 100m, unitCost: 40m);
        await Buy(product.Sku, 2);

        var after = await Dashboard();

        // 2 × 100 + envío de paquetería (99).
        Assert.Equal(299m, after.GetProperty("kpis").GetProperty("sales").GetProperty("value").GetDecimal() - before.GetProperty("kpis").GetProperty("sales").GetProperty("value").GetDecimal());
        Assert.Equal(1, after.GetProperty("kpis").GetProperty("orders").GetProperty("value").GetInt32() - before.GetProperty("kpis").GetProperty("orders").GetProperty("value").GetInt32());
        var line = LineOf(after, "accesorios");
        Assert.Equal(2, line.GetProperty("units").GetInt32() - LineOf(before, "accesorios").GetProperty("units").GetInt32());
        Assert.Equal(200m, line.GetProperty("revenue").GetDecimal() - LineOf(before, "accesorios").GetProperty("revenue").GetDecimal());
        Assert.True(line.GetProperty("margin").GetDouble() > 0);
        Assert.Equal(30, after.GetProperty("daily").GetArrayLength());
        Assert.True(after.GetProperty("daily")[29].GetProperty("v").GetDecimal() >= 299m);
        var brands = after.GetProperty("catalog").GetProperty("brands").EnumerateArray().Select(b => b.GetProperty("slug").GetString()).ToList();
        Assert.Contains("sin-marca", brands);
        Assert.Equal(brands.Distinct(), brands);
    }

    [Fact]
    public async Task Products_without_cost_stay_out_of_the_margin_and_are_counted()
    {
        var withCost = await CreateProduct(5, price: 100m, unitCost: 60m);
        var withoutCost = await CreateProduct(5, price: 100m);
        var before = LineOf(await Dashboard(), "accesorios").GetProperty("missingCost").GetInt32();
        await Buy(withCost.Sku);
        await Buy(withoutCost.Sku);

        // El producto sin costo ya contaba al crearse; lo vendido sin costo no cambia ese número.
        var line = LineOf(await Dashboard(), "accesorios");
        Assert.Equal(before, line.GetProperty("missingCost").GetInt32());
        Assert.True(before >= 1);
    }

    [Fact]
    public async Task Pending_oxxo_and_cancelled_orders_are_not_sales()
    {
        var product = await CreateProduct(5);
        var before = (await Dashboard()).GetProperty("kpis").GetProperty("orders").GetProperty("value").GetInt32();

        await Buy(product.Sku, payment: "oxxo_pay");
        var card = await Buy(product.Sku);
        var order = await OrderOf(card);
        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/admin/orders/{card}/cancel", Owner, new { rowVersion = VersionOf(order) })).StatusCode);

        Assert.Equal(before, (await Dashboard()).GetProperty("kpis").GetProperty("orders").GetProperty("value").GetInt32());
    }

    [Fact]
    public async Task Queue_and_recent_follow_the_orders()
    {
        var product = await CreateProduct(5);
        var before = await Dashboard(role: Operations);
        var folio = await Buy(product.Sku);

        var after = await Dashboard(role: Operations);

        Assert.Equal(1, after.GetProperty("queue").GetProperty("por_preparar").GetInt32() - before.GetProperty("queue").GetProperty("por_preparar").GetInt32());
        Assert.Equal(folio, after.GetProperty("recent")[0].GetProperty("id").GetString());
        Assert.True(after.GetProperty("recent").GetArrayLength() <= 5);
    }

    [Fact]
    public async Task Inventory_cards_have_the_shape_of_the_panel()
    {
        var empty = await CreateProduct(0);
        var dashboard = await Dashboard(role: Operations);

        Assert.Contains(empty.Sku, dashboard.GetProperty("alerts").EnumerateArray().Select(a => a.GetProperty("sku").GetString()));
        var edition = dashboard.GetProperty("editions").EnumerateArray().Single(e => e.GetProperty("name").GetString() == "Tabi Origami Noche");
        Assert.Equal(120, edition.GetProperty("edition").GetInt32());
        Assert.True(edition.GetProperty("low").GetBoolean());
        var seasons = dashboard.GetProperty("catalog").GetProperty("seasons").EnumerateArray().Select(s => s.GetProperty("slug").GetString()).ToList();
        Assert.Contains("navidad", seasons);
        Assert.Contains("halloween", seasons);
        Assert.Equal(4, dashboard.GetProperty("few").GetInt32());
    }

    [Fact]
    public async Task Size_share_adds_up_to_100_when_there_are_sales()
    {
        var product = await CreateProduct(5);
        await Buy(product.Sku, 3);

        var sizes = (await Dashboard("30d")).GetProperty("sizes").EnumerateArray().ToList();

        Assert.Equal(100, sizes.Sum(s => s.GetProperty("v").GetInt32()));
        Assert.Contains(sizes, s => s.GetProperty("code").GetString() == "U");
    }
}
