using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Archivo listo para descargar.</summary>
public record CsvFile(string FileName, byte[] Content);

/// <summary>Periodo de días locales (Los Mochis), inclusivo.</summary>
public record ReportPeriod(DateOnly From, DateOnly To)
{
    public const int MaxDays = 366;

    public int Days => To.DayNumber - From.DayNumber + 1;

    /// <summary>El periodo inmediato anterior, de la misma duración.</summary>
    public ReportPeriod Previous => new(From.AddDays(-Days), From.AddDays(-1));

    public bool IsWholeMonth => From.Day == 1 && To == From.AddMonths(1).AddDays(-1);

    public bool Contains(DateOnly day) => day >= From && day <= To;

    /// <summary><c>from</c> y <c>to</c> en <c>YYYY-MM-DD</c>; errores por campo si no sirven.</summary>
    public static AdminResult<ReportPeriod> Parse(string? from, string? to)
    {
        var errors = new Dictionary<string, string>();
        var start = ParseDate(from, "from", "Elija la fecha de inicio.", errors);
        var end = ParseDate(to, "to", "Elija la fecha final.", errors);
        if (errors.Count > 0)
        {
            return AdminResult<ReportPeriod>.Invalid(errors);
        }

        var period = new ReportPeriod(start!.Value, end!.Value);
        if (period.To < period.From)
        {
            errors["to"] = "La fecha final es anterior a la de inicio.";
        }
        else if (period.Days > MaxDays)
        {
            errors["to"] = $"El periodo puede ser de {MaxDays} días como máximo.";
        }
        return errors.Count > 0 ? AdminResult<ReportPeriod>.Invalid(errors) : AdminResult<ReportPeriod>.Ok(period);
    }

    private static DateOnly? ParseDate(string? text, string field, string missing, Dictionary<string, string> errors)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            errors[field] = missing;
            return null;
        }
        if (!DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            errors[field] = "Escriba la fecha como AAAA-MM-DD.";
            return null;
        }
        return date;
    }
}

/// <summary>Servicio de entidad de solo lectura: reportes de ventas (sección Reportes, solo el Dueño).</summary>
public interface IReportService
{
    Task<AdminResult<SalesReportDto>> GetSalesAsync(string? from, string? to, CancellationToken cancellationToken = default);

    /// <summary>Una fila por pedido del periodo: el archivo mensual para el contador externo (DECISIONES_ADMIN).</summary>
    Task<AdminResult<CsvFile>> GetSalesCsvAsync(string? from, string? to, CancellationToken cancellationToken = default);
}

public class ReportService(SokkoDbContext db) : IReportService
{
    private const int TopProducts = 10;

    public static readonly string[] CsvHeader =
    [
        "Folio", "Fecha (hora de Los Mochis)", "Cliente", "Correo", "Método de pago", "Estado de pago", "Estado del pedido",
        "Subtotal", "Envío", "IVA incluido", "Total",
    ];

    public static string PaymentMethodLabel(PaymentMethod method) => method == PaymentMethod.Tarjeta ? "Tarjeta" : "OXXO Pay";

    public static string PaymentStatusLabel(PaymentStatus status) => status switch
    {
        PaymentStatus.Pagado => "Pagado",
        PaymentStatus.Reembolsado => "Reembolsado",
        _ => "Pendiente",
    };

    public static string OrderStatusLabel(OrderStatus status) => status switch
    {
        OrderStatus.PorPreparar => "Por preparar",
        OrderStatus.Preparando => "Preparando",
        OrderStatus.Enviado => "Enviado",
        OrderStatus.EnRuta => "En ruta",
        OrderStatus.Entregado => "Entregado",
        OrderStatus.Cancelado => "Cancelado",
        _ => "Pagado",
    };

    /// <summary><c>sokko-ventas-2026-11.csv</c> si es un mes completo; si no, con las dos fechas.</summary>
    public static string CsvFileName(ReportPeriod period) => period.IsWholeMonth
        ? $"sokko-ventas-{period.From:yyyy-MM}.csv"
        : $"sokko-ventas-{period.From:yyyy-MM-dd}_a_{period.To:yyyy-MM-dd}.csv";

    private static DashboardMoneyDto Money(decimal current, decimal previous) => new(current, previous, SalesFigures.PercentChange(current, previous));

    private static DashboardCountDto Count(int current, int previous) => new(current, previous, SalesFigures.PercentChange((double)current, previous));

    private static int Units(IEnumerable<Order> orders) => orders.SelectMany(o => o.Items).Sum(i => i.Quantity);

    public async Task<AdminResult<SalesReportDto>> GetSalesAsync(string? from, string? to, CancellationToken cancellationToken = default)
    {
        var parsed = ReportPeriod.Parse(from, to);
        if (parsed.Value is not { } period)
        {
            return AdminResult<SalesReportDto>.Invalid(parsed.Errors!);
        }

        var previous = period.Previous;
        var loaded = await SalesFigures.LoadSalesAsync(db, previous.From, period.To, cancellationToken);
        var byDay = loaded.ToLookup(o => BusinessTime.DateOf(o.CreatedAt));
        var current = loaded.Where(o => period.Contains(BusinessTime.DateOf(o.CreatedAt))).ToList();
        var before = loaded.Where(o => previous.Contains(BusinessTime.DateOf(o.CreatedAt))).ToList();

        var cancelled = (await SalesFigures.CreatedBetween(db.Orders.AsNoTracking(), previous.From, period.To)
            .Where(o => o.Status == OrderStatus.Cancelado)
            .Select(o => o.CreatedAt)
            .ToListAsync(cancellationToken))
            .Select(BusinessTime.DateOf)
            .ToList();

        var kpis = new SalesReportKpisDto(
            Money(current.Sum(o => o.Total), before.Sum(o => o.Total)),
            Count(current.Count, before.Count),
            Money(SalesFigures.Ticket(current.Sum(o => o.Total), current.Count), SalesFigures.Ticket(before.Sum(o => o.Total), before.Count)),
            Money(current.Sum(o => o.TaxIncluded), before.Sum(o => o.TaxIncluded)),
            Money(current.Sum(o => o.ShippingCost), before.Sum(o => o.ShippingCost)),
            Count(cancelled.Count(period.Contains), cancelled.Count(previous.Contains)),
            Count(Units(current), Units(before)));

        var daily = Enumerable.Range(0, period.Days).Select(i =>
        {
            var day = period.From.AddDays(i);
            var prev = previous.From.AddDays(i);
            return new SalesReportDayDto(BusinessTime.NoonUtc(day), byDay[day].Sum(o => o.Total), byDay[day].Count(), byDay[prev].Sum(o => o.Total), byDay[prev].Count());
        }).ToList();

        var items = current.SelectMany(o => o.Items).ToList();
        var lines = Enum.GetValues<ProductLine>()
            .Select(line =>
            {
                var sold = items.Where(i => i.Variant.Product.Line == line).ToList();
                return new SalesReportLineDto(line, sold.Sum(i => i.Quantity), sold.Sum(i => i.Quantity * i.UnitPrice));
            })
            .ToList();

        var top = items
            .GroupBy(i => i.Variant.ProductId)
            .Select(g => new SalesReportProductDto(g.Key, g.First().ProductNameSnapshot, g.First().Variant.Product.Line, g.Sum(i => i.Quantity), g.Sum(i => i.Quantity * i.UnitPrice)))
            .OrderByDescending(p => p.Units)
            .ThenByDescending(p => p.Revenue)
            .ThenBy(p => p.Name, StringComparer.CurrentCulture)
            .Take(TopProducts)
            .ToList();

        var payments = Enum.GetValues<PaymentMethod>()
            .Select(m =>
            {
                var list = current.Where(o => o.PaymentMethod == m).ToList();
                return new SalesReportPaymentDto(m, list.Count, list.Sum(o => o.Total));
            })
            .ToList();
        var deliveries = Enum.GetValues<DeliveryMethod>()
            .Select(m =>
            {
                var list = current.Where(o => o.DeliveryMethod == m).ToList();
                return new SalesReportDeliveryDto(m, list.Count, list.Sum(o => o.Total), list.Sum(o => o.ShippingCost));
            })
            .ToList();

        return AdminResult<SalesReportDto>.Ok(new SalesReportDto(period.From, period.To, previous.From, previous.To, kpis, daily, lines, top, payments, deliveries));
    }

    public async Task<AdminResult<CsvFile>> GetSalesCsvAsync(string? from, string? to, CancellationToken cancellationToken = default)
    {
        var parsed = ReportPeriod.Parse(from, to);
        if (parsed.Value is not { } period)
        {
            return AdminResult<CsvFile>.Invalid(parsed.Errors!);
        }

        var orders = await SalesFigures.CreatedBetween(db.Orders.AsNoTracking(), period.From, period.To)
            .OrderBy(o => o.CreatedAt).ThenBy(o => o.FolioNumber)
            .ToListAsync(cancellationToken);

        var csv = new CsvWriter(CsvHeader);
        foreach (var o in orders)
        {
            csv.Row(
                o.Folio,
                BusinessTime.ToLocal(o.CreatedAt).ToString("yyyy-MM-dd HH:mm", CultureInfo.InvariantCulture),
                $"{o.CustomerFirstName} {o.CustomerLastName}".Trim(),
                o.CustomerEmail,
                PaymentMethodLabel(o.PaymentMethod),
                PaymentStatusLabel(o.PaymentStatus),
                OrderStatusLabel(o.Status),
                o.Subtotal,
                o.ShippingCost,
                o.TaxIncluded,
                o.Total);
        }
        return AdminResult<CsvFile>.Ok(new CsvFile(CsvFileName(period), csv.ToBytes()));
    }
}
