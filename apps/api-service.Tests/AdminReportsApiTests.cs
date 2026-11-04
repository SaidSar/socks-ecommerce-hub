using System.Net;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class AdminReportsApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Url = "/api/admin/reports/sales";
    private const string CsvUrl = "/api/admin/reports/sales.csv";

    // Un día sin otras compras de la semilla, para medir solo lo que crea cada prueba.
    private static readonly DateOnly Quiet = new(2019, 3, 9);

    private static string Day(DateOnly d) => d.ToString("yyyy-MM-dd");

    private async Task<JsonElement> Report(DateOnly from, DateOnly to) => await Json(await Get($"{Url}?from={Day(from)}&to={Day(to)}", Owner));

    private static decimal Money(JsonElement report, string kpi) => report.GetProperty("kpis").GetProperty(kpi).GetProperty("value").GetDecimal();

    private static int Count(JsonElement report, string kpi) => report.GetProperty("kpis").GetProperty(kpi).GetProperty("value").GetInt32();

    private async Task Rename(string folio, string firstName)
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Orders.Where(o => o.Folio == folio).ExecuteUpdateAsync(u => u.SetProperty(o => o.CustomerFirstName, firstName), Ct);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.Forbidden)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Reports_are_only_for_the_owner(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get($"{Url}?from=2026-11-01&to=2026-11-30", role)).StatusCode);
        Assert.Equal(expected, (await Get($"{CsvUrl}?from=2026-11-01&to=2026-11-30", role)).StatusCode);
    }

    [Theory]
    [InlineData("")]
    [InlineData("?from=2026-11-01")]
    [InlineData("?from=2026-11-30&to=2026-11-01")]
    [InlineData("?from=2026/11/01&to=2026-11-30")]
    [InlineData("?from=2025-01-01&to=2026-01-02")]
    public async Task Invalid_or_too_long_ranges_get_400(string query)
    {
        Assert.Equal(HttpStatusCode.BadRequest, (await Get(Url + query, Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Get(CsvUrl + query, Owner)).StatusCode);
    }

    [Fact]
    public async Task A_whole_year_of_366_days_is_allowed()
    {
        var report = await Report(new DateOnly(2027, 11, 5), new DateOnly(2028, 11, 4));
        Assert.Equal(366, report.GetProperty("daily").GetArrayLength());
    }

    [Fact]
    public async Task A_purchase_at_2330_local_counts_on_its_local_day()
    {
        var product = await CreateProduct(5);
        var beforeDay = await Report(Quiet, Quiet);
        var beforeNext = await Report(Quiet.AddDays(1), Quiet.AddDays(1));
        var folio = await Buy(product.Sku);
        // 23:30 del 9 de marzo en Los Mochis = 06:30 UTC del 10.
        await SetCreatedAt(folio, new DateTime(2019, 3, 10, 6, 30, 0, DateTimeKind.Utc));

        var day = await Report(Quiet, Quiet);
        Assert.Equal(1, Count(day, "orders") - Count(beforeDay, "orders"));
        Assert.Equal(199m, Money(day, "sales") - Money(beforeDay, "sales"));
        Assert.Equal(Count(beforeNext, "orders"), Count(await Report(Quiet.AddDays(1), Quiet.AddDays(1)), "orders"));
        Assert.Equal(199m, day.GetProperty("daily")[0].GetProperty("v").GetDecimal() - beforeDay.GetProperty("daily")[0].GetProperty("v").GetDecimal());

        var csv = Encoding.UTF8.GetString(await (await Get($"{CsvUrl}?from={Day(Quiet)}&to={Day(Quiet)}", Owner)).Content.ReadAsByteArrayAsync(Ct));
        Assert.Contains($"{folio},2019-03-09 23:30,", csv);
    }

    [Fact]
    public async Task Kpis_breakdowns_and_previous_period()
    {
        var product = await CreateProduct(10, price: 100m, unitCost: 40m);
        var start = Quiet.AddDays(-30);
        var before = await Report(start, start.AddDays(1));
        var card = await Buy(product.Sku, 2);
        var oxxo = await Buy(product.Sku, payment: "oxxo_pay");
        var cancelled = await Buy(product.Sku);
        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/admin/orders/{cancelled}/cancel", Owner, new { rowVersion = VersionOf(await OrderOf(cancelled)) })).StatusCode);
        var previous = await Buy(product.Sku);
        foreach (var folio in new[] { card, oxxo, cancelled })
        {
            await SetCreatedAt(folio, BusinessTime.NoonUtc(start));
        }
        await SetCreatedAt(previous, BusinessTime.NoonUtc(start.AddDays(-1)));

        var after = await Report(start, start.AddDays(1));

        // Solo la compra con tarjeta es venta: 2 × 100 + 99 de envío.
        Assert.Equal(299m, Money(after, "sales") - Money(before, "sales"));
        Assert.Equal(1, Count(after, "orders") - Count(before, "orders"));
        Assert.Equal(1, Count(after, "cancelled") - Count(before, "cancelled"));
        Assert.Equal(2, Count(after, "units") - Count(before, "units"));
        Assert.Equal(99m, Money(after, "shipping") - Money(before, "shipping"));
        Assert.True(Money(after, "taxIncluded") > Money(before, "taxIncluded"));
        // El periodo anterior (2 días antes) tiene la compra del día previo.
        Assert.Equal(1, after.GetProperty("kpis").GetProperty("orders").GetProperty("prev").GetInt32() - before.GetProperty("kpis").GetProperty("orders").GetProperty("prev").GetInt32());
        Assert.Equal(Day(start.AddDays(-2)), after.GetProperty("prevFrom").GetString());

        var top = after.GetProperty("top").EnumerateArray().Single(p => p.GetProperty("productId").GetInt32() == product.Id);
        Assert.Equal(2, top.GetProperty("units").GetInt32());
        Assert.Equal(200m, top.GetProperty("revenue").GetDecimal());
        Assert.Equal(["tarjeta", "oxxo_pay"], after.GetProperty("payments").EnumerateArray().Select(p => p.GetProperty("method").GetString()));
        Assert.Equal(["local", "paqueteria"], after.GetProperty("deliveries").EnumerateArray().Select(p => p.GetProperty("method").GetString()));
        Assert.Equal(4, after.GetProperty("lines").GetArrayLength());
    }

    [Theory]
    [InlineData("hoy", 1)]
    [InlineData("7d", 7)]
    [InlineData("30d", 30)]
    public async Task Same_numbers_as_the_dashboard_for_the_same_range(string range, int days)
    {
        var product = await CreateProduct(5);
        await Buy(product.Sku);
        var today = BusinessTime.DateOf(DateTime.UtcNow);

        var dashboard = (await Json(await Get($"/api/admin/dashboard?range={range}", Owner))).GetProperty("kpis");
        var report = (await Report(today.AddDays(1 - days), today)).GetProperty("kpis");

        Assert.Equal(dashboard.GetProperty("sales").GetProperty("value").GetDecimal(), report.GetProperty("sales").GetProperty("value").GetDecimal());
        Assert.Equal(dashboard.GetProperty("orders").GetProperty("value").GetInt32(), report.GetProperty("orders").GetProperty("value").GetInt32());
        Assert.Equal(dashboard.GetProperty("ticket").GetProperty("value").GetDecimal(), report.GetProperty("ticket").GetProperty("value").GetDecimal());
    }

    [Fact]
    public async Task Csv_has_bom_one_row_per_order_and_no_formulas()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku);
        await SetCreatedAt(folio, BusinessTime.NoonUtc(new DateOnly(2019, 2, 14)));
        await Rename(folio, "=HYPERLINK(\"http://malo.example\")");

        var response = await Get($"{CsvUrl}?from=2019-02-01&to=2019-02-28", Owner);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/csv", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal("sokko-ventas-2019-02.csv", response.Content.Headers.ContentDisposition!.FileName?.Trim('"'));
        var bytes = await response.Content.ReadAsByteArrayAsync(Ct);
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes[..3]);
        var lines = Encoding.UTF8.GetString(bytes[3..]).Split("\r\n", StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(string.Join(',', ReportService.CsvHeader), lines[0]);
        var row = lines.Single(l => l.StartsWith(folio + ",", StringComparison.Ordinal));
        Assert.Contains(",\"'=HYPERLINK(\"\"http://malo.example\"\") López\",", row);
        Assert.EndsWith(",Tarjeta,Pagado,Por preparar,100.00,,0.00,99.00,27.45,199.00", row);
    }
}
