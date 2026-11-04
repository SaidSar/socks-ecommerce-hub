using System.Text;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class BusinessTimeTests
{
    [Fact]
    public void A_purchase_at_2330_local_belongs_to_its_local_day()
    {
        // 23:30 en Los Mochis (UTC−7) = 06:30 UTC del día siguiente.
        var utc = new DateTime(2026, 11, 5, 6, 30, 0, DateTimeKind.Utc);
        Assert.Equal(new DateOnly(2026, 11, 4), BusinessTime.DateOf(utc));
        Assert.Equal(new DateTime(2026, 11, 4, 23, 30, 0), BusinessTime.ToLocal(utc));
    }

    [Fact]
    public void Local_days_start_at_0700_utc_all_year()
    {
        // Sin horario de verano: igual en enero que en julio.
        Assert.Equal(new DateTime(2026, 1, 15, 7, 0, 0, DateTimeKind.Utc), BusinessTime.StartOfDayUtc(new DateOnly(2026, 1, 15)));
        Assert.Equal(new DateTime(2026, 7, 15, 7, 0, 0, DateTimeKind.Utc), BusinessTime.StartOfDayUtc(new DateOnly(2026, 7, 15)));
        var (from, to) = BusinessTime.RangeUtc(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30));
        Assert.Equal(new DateTime(2026, 11, 1, 7, 0, 0, DateTimeKind.Utc), from);
        Assert.Equal(new DateTime(2026, 12, 1, 7, 0, 0, DateTimeKind.Utc), to);
    }
}

public class CsvWriterTests
{
    [Theory]
    [InlineData("=HYPERLINK(\"http://x\")", "\"'=HYPERLINK(\"\"http://x\"\")\"")]
    [InlineData("+52 668", "'+52 668")]
    [InlineData("-1+1", "'-1+1")]
    [InlineData("@SUM(A1)", "'@SUM(A1)")]
    [InlineData("\tcmd", "'\tcmd")]
    [InlineData("\rcmd", "\"'\rcmd\"")]
    [InlineData("Ana López", "Ana López")]
    [InlineData("López, Ana", "\"López, Ana\"")]
    [InlineData("ana@correo.mx", "ana@correo.mx")]
    public void Text_cells_never_become_formulas(string text, string expected) =>
        Assert.Equal(expected, CsvWriter.Cell(text));

    [Fact]
    public void Numbers_use_a_dot_and_are_not_guarded()
    {
        Assert.Equal("1234.50", CsvWriter.Cell(1234.5m));
        Assert.Equal("-3", CsvWriter.Cell(-3));
        Assert.Equal("", CsvWriter.Cell(null));
        Assert.Equal("Sí", CsvWriter.Cell(true));
    }

    [Fact]
    public void File_starts_with_bom_and_uses_crlf()
    {
        var bytes = new CsvWriter("A", "B").Row("x", 1m).ToBytes();
        Assert.Equal([0xEF, 0xBB, 0xBF], bytes[..3]);
        Assert.Equal("A,B\r\nx,1.00\r\n", Encoding.UTF8.GetString(bytes[3..]));
    }
}

public class ReportPeriodTests
{
    [Theory]
    [InlineData(null, "2026-11-30", "from")]
    [InlineData("2026-11-01", "", "to")]
    [InlineData("01/11/2026", "2026-11-30", "from")]
    [InlineData("2026-11-30", "2026-11-01", "to")]
    [InlineData("2025-01-01", "2026-01-02", "to")]
    public void Invalid_ranges_say_which_field(string? from, string? to, string field)
    {
        var result = ReportPeriod.Parse(from, to);
        Assert.Equal(AdminOutcome.Invalid, result.Outcome);
        Assert.True(result.Errors!.ContainsKey(field));
    }

    [Fact]
    public void Up_to_366_days_and_the_previous_period_has_the_same_length()
    {
        var leap = ReportPeriod.Parse("2028-01-01", "2028-12-31").Value!;
        Assert.Equal(366, leap.Days);
        var november = ReportPeriod.Parse("2026-11-01", "2026-11-30").Value!;
        Assert.Equal(new ReportPeriod(new DateOnly(2026, 10, 2), new DateOnly(2026, 10, 31)), november.Previous);
    }

    [Fact]
    public void File_name_is_the_month_or_the_range()
    {
        Assert.Equal("sokko-ventas-2026-11.csv", ReportService.CsvFileName(new ReportPeriod(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 30))));
        Assert.Equal("sokko-ventas-2026-02.csv", ReportService.CsvFileName(new ReportPeriod(new DateOnly(2026, 2, 1), new DateOnly(2026, 2, 28))));
        Assert.Equal("sokko-ventas-2026-11-01_a_2026-11-15.csv", ReportService.CsvFileName(new ReportPeriod(new DateOnly(2026, 11, 1), new DateOnly(2026, 11, 15))));
    }

    [Fact]
    public void Csv_labels_are_in_spanish()
    {
        Assert.Equal("OXXO Pay", ReportService.PaymentMethodLabel(PaymentMethod.OxxoPay));
        Assert.Equal("Reembolsado", ReportService.PaymentStatusLabel(PaymentStatus.Reembolsado));
        Assert.Equal("En ruta", ReportService.OrderStatusLabel(OrderStatus.EnRuta));
    }
}
