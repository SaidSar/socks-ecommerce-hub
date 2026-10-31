using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Dashboard completo dentro del servicio. Sale a la API solo por <see cref="ToOwner"/> o <see cref="ToOperations"/> (R-24).</summary>
public record DashboardView(OwnerDashboardDto Owner, IReadOnlyList<AdminOrderView> Recent)
{
    public OwnerDashboardDto ToOwner() => Owner;

    public OperationsDashboardDto ToOperations() => new(
        Owner.Now,
        Owner.Few,
        new OperationsKpisDto(Owner.Kpis.Range, Owner.Kpis.Orders, Owner.Kpis.FreePct, Owner.Kpis.CompareDate),
        Owner.Queue,
        Owner.Alerts,
        Owner.Top,
        Owner.Sizes,
        Owner.Editions,
        Recent.Select(o => o.ToOperations()).ToList(),
        new OperationsDashboardCatalogDto(
            Owner.Catalog.Lines.Select(l => new OperationsLineDto(l.Line, l.Units)).ToList(),
            Owner.Catalog.UnitsSold,
            Owner.Catalog.FewUnits,
            Owner.Catalog.Seasons,
            Owner.Catalog.Today));
}

/// <summary>Servicio de entidad de solo lectura: cifras del panel (DESIGN_ADMIN §5.5 y DESIGN_CATALOG_UI §4.2).</summary>
public interface IDashboardService
{
    /// <summary><c>null</c> si el rango no existe (hoy, 7d o 30d).</summary>
    Task<DashboardView?> GetAsync(string? range, CancellationToken cancellationToken = default);
}

public class DashboardService(
    SokkoDbContext db,
    IOrderAdminService orders,
    IInventoryAdminService inventory,
    ISettingsService settings,
    IClock clock) : IDashboardService
{
    private const int ChartDays = 30;
    private const int RecentOrders = 5;
    private const int TopPieces = 5;
    private const double LowEditionRatio = 0.2;
    // Mediodía en America/Mazatlan (UTC−7, sin horario de verano): la fecha no cambia al mostrarla en el panel.
    private const int NoonUtcHour = 19;

    /// <summary>Lo que cuenta como venta: pagado y sin cancelar. Un OXXO pendiente todavía no es una venta.</summary>
    private sealed record Sale(DateOnly Day, decimal Total, bool Free, Order Order);

    private static double? PercentChange(decimal current, decimal previous) =>
        previous == 0 ? null : (double)((current - previous) / previous) * 100;

    private static double? PercentChange(double current, double previous) =>
        previous == 0 ? null : (current - previous) / previous * 100;

    private static double FreePercent(IReadOnlyCollection<Sale> sales) =>
        sales.Count == 0 ? 0 : (double)sales.Count(s => s.Free) / sales.Count * 100;

    private static decimal Ticket(IReadOnlyCollection<Sale> sales) =>
        sales.Count == 0 ? 0 : Math.Round(sales.Sum(s => s.Total) / sales.Count, 2, MidpointRounding.AwayFromZero);

    public async Task<DashboardView?> GetAsync(string? range, CancellationToken cancellationToken = default)
    {
        var key = string.IsNullOrEmpty(range) ? "hoy" : range;
        var days = key switch { "hoy" => 1, "7d" => 7, "30d" => 30, _ => 0 };
        if (days == 0)
        {
            return null;
        }

        var now = clock.UtcNow;
        var today = clock.Today;
        var config = await settings.GetConfigAsync(cancellationToken);

        // Dos periodos de la gráfica, con un día de margen por el cambio de zona horaria.
        var since = DateTime.SpecifyKind(today.AddDays(-2 * ChartDays - 1).ToDateTime(TimeOnly.MinValue), DateTimeKind.Utc);
        var loaded = await db.Orders
            .AsNoTracking()
            .Where(o => o.CreatedAt >= since && o.Status != OrderStatus.Cancelado && o.PaymentStatus == PaymentStatus.Pagado)
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product).ThenInclude(p => p.Brand)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);
        var sales = loaded.Select(o => new Sale(SystemClock.ToBusinessDate(o.CreatedAt), o.Total, o.ShippingCost == 0, o)).ToList();

        List<Sale> Between(DateOnly from, DateOnly to) => sales.Where(s => s.Day >= from && s.Day <= to).ToList();

        var current = Between(today.AddDays(1 - days), today);
        // "Hoy" se compara con el mismo día de la semana anterior; 7d y 30d, con el periodo previo.
        var compareDay = today.AddDays(-7);
        var previous = key == "hoy" ? Between(compareDay, compareDay) : Between(today.AddDays(1 - 2 * days), today.AddDays(-days));

        var kpis = new OwnerKpisDto(
            key,
            Money(current.Sum(s => s.Total), previous.Sum(s => s.Total)),
            new DashboardCountDto(current.Count, previous.Count, PercentChange((double)current.Count, previous.Count)),
            Money(Ticket(current), Ticket(previous)),
            new DashboardPercentDto(FreePercent(current), FreePercent(previous), PercentChange(FreePercent(current), FreePercent(previous))),
            key == "hoy" ? Noon(compareDay) : null);

        var last30 = Between(today.AddDays(1 - ChartDays), today);
        var alerts = (await inventory.ListAsync("alertas", null, cancellationToken))!.Rows
            .OrderBy(r => r.Available).ThenBy(r => r.Sku, StringComparer.Ordinal).ToList();
        var recent = await orders.ListRecentAsync(RecentOrders, cancellationToken);

        var owner = new OwnerDashboardDto(
            now,
            config.FewUnitsThreshold,
            kpis,
            await QueueAsync(now, cancellationToken),
            alerts,
            TopOf(last30),
            await SizesOfAsync(last30, cancellationToken),
            await EditionsAsync(cancellationToken),
            recent.Select(o => o.ToOwner()).ToList(),
            Enumerable.Range(0, ChartDays).Select(i => DayOf(today.AddDays(i + 1 - ChartDays), Between)).ToList(),
            await CatalogAsync(current, config.FewUnitsThreshold, today, cancellationToken));
        return new DashboardView(owner, recent);
    }

    private static DashboardMoneyDto Money(decimal current, decimal previous) => new(current, previous, PercentChange(current, previous));

    private static DateTime Noon(DateOnly day) => DateTime.SpecifyKind(day.ToDateTime(new TimeOnly(NoonUtcHour, 0)), DateTimeKind.Utc);

    private static DashboardDayDto DayOf(DateOnly day, Func<DateOnly, DateOnly, List<Sale>> between)
    {
        var sales = between(day, day);
        var before = between(day.AddDays(-ChartDays), day.AddDays(-ChartDays));
        return new DashboardDayDto(Noon(day), sales.Sum(s => s.Total), sales.Count, sales.Count(s => s.Free), before.Sum(s => s.Total), before.Count, before.Count(s => s.Free));
    }

    private async Task<IReadOnlyDictionary<string, int>> QueueAsync(DateTime now, CancellationToken cancellationToken)
    {
        var summary = await orders.GetSummaryAsync(cancellationToken);
        var all = db.Orders.AsNoTracking();
        return new Dictionary<string, int>
        {
            ["por_preparar"] = summary.ToPrepare,
            ["preparando"] = await all.CountAsync(o => o.Status == OrderStatus.Preparando, cancellationToken),
            ["late"] = summary.Late,
            ["en_ruta"] = await all.CountAsync(o => o.Status == OrderStatus.EnRuta, cancellationToken),
        };
    }

    private static List<DashboardBarDto> TopOf(IEnumerable<Sale> sales) =>
        sales.SelectMany(s => s.Order.Items)
            .GroupBy(i => i.ProductNameSnapshot)
            .Select(g => new DashboardBarDto(g.Key, g.Sum(i => i.Quantity)))
            .OrderByDescending(b => b.V)
            .ThenBy(b => b.K, StringComparer.CurrentCulture)
            .Take(TopPieces)
            .ToList();

    /// <summary>Porcentaje de unidades por talla; suma 100 tras redondear.</summary>
    private async Task<List<DashboardSizeDto>> SizesOfAsync(IEnumerable<Sale> sales, CancellationToken cancellationToken)
    {
        var sizes = await db.Sizes.AsNoTracking().OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);
        var calceta = sizes.Where(s => s.SizeSystem == SizeSystem.Calceta).ToList();
        var units = calceta.ToDictionary(s => s.Code, _ => 0);
        foreach (var item in sales.SelectMany(s => s.Order.Items))
        {
            units[item.SizeCodeSnapshot] = units.GetValueOrDefault(item.SizeCodeSnapshot) + item.Quantity;
        }

        var total = units.Values.Sum();
        var rows = units.Select(u =>
        {
            var label = calceta.FirstOrDefault(s => s.Code == u.Key)?.Label ?? sizes.FirstOrDefault(s => s.Code == u.Key)?.Label;
            var share = total == 0 ? 0 : (int)Math.Round((double)u.Value / total * 100, MidpointRounding.AwayFromZero);
            return new DashboardSizeDto(label is null ? u.Key : $"{u.Key} · {label}", u.Key, share);
        }).ToList();

        var drift = 100 - rows.Sum(r => r.V);
        if (total > 0 && drift != 0)
        {
            var largest = rows.MaxBy(r => r.V)!;
            rows[rows.IndexOf(largest)] = largest with { V = largest.V + drift };
        }
        return rows;
    }

    private async Task<List<DashboardEditionDto>> EditionsAsync(CancellationToken cancellationToken)
    {
        var editions = await db.Products
            .AsNoTracking()
            .Where(p => p.EditionSize != null && p.IsActive)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new { p.Id, p.Name, Edition = p.EditionSize!.Value, Left = p.Variants.Where(v => v.IsActive).Sum(v => v.Stock) })
            .ToListAsync(cancellationToken);
        return editions.Select(e =>
        {
            var ratio = (double)e.Left / e.Edition;
            return new DashboardEditionDto(e.Id, e.Name, e.Edition, e.Left, ratio, ratio < LowEditionRatio);
        }).ToList();
    }

    private async Task<OwnerDashboardCatalogDto> CatalogAsync(IReadOnlyCollection<Sale> sales, int few, DateOnly today, CancellationToken cancellationToken)
    {
        var products = await db.Products
            .AsNoTracking()
            .Where(p => p.IsActive)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new
            {
                p.Slug,
                p.Name,
                p.Line,
                p.CollectionId,
                HasCost = p.Variants.Any(v => v.IsActive && v.UnitCost != null),
                Stock = p.Variants.Where(v => v.IsActive).Sum(v => v.Stock),
            })
            .ToListAsync(cancellationToken);

        var items = sales.SelectMany(s => s.Order.Items).ToList();

        var lines = Enum.GetValues<ProductLine>().Select(line =>
        {
            var sold = items.Where(i => i.Variant.Product.Line == line).ToList();
            return new OwnerLineDto(line, sold.Sum(i => i.Quantity), sold.Sum(i => i.Quantity * i.UnitPrice), MarginOf(sold), products.Count(p => p.Line == line && !p.HasCost));
        }).ToList();

        var brands = items
            .Where(i => i.Variant.UnitCost is not null)
            // Por slug: sin seguimiento de cambios, cada línea trae su propia instancia de la marca.
            .GroupBy(i => i.Variant.Product.Brand.Slug)
            .Select(g => new DashboardBrandDto(g.Key, g.First().Variant.Product.Brand.Name, g.Sum(i => i.Quantity * i.UnitPrice), MarginOf(g) ?? 0))
            .OrderByDescending(b => b.Revenue)
            .ToList();

        var collections = await db.Collections.AsNoTracking().Where(c => c.Kind == CollectionKind.Temporada && c.IsActive).OrderBy(c => c.Id).ToListAsync(cancellationToken);
        var seasons = collections
            .Select(c => new DashboardSeasonDto(c.Slug, c.Name, c.Kind, c.StartMonth, c.StartDay, c.EndMonth, c.EndDay, products.Where(p => p.CollectionId == c.Id).Sum(p => p.Stock)))
            .ToList();

        return new OwnerDashboardCatalogDto(
            lines,
            MarginOf(items),
            brands,
            items.Sum(i => i.Quantity),
            products.Where(p => p.Stock <= few).Select(p => new DashboardFewUnitsDto(p.Slug, p.Name, p.Stock)).ToList(),
            seasons,
            new AdminToday(today.Year, today.Month, today.Day));
    }

    /// <summary>Margen bruto sobre lo vendido con costo registrado; lo que no tiene costo no entra (DESIGN_CATALOG_UI §4.2).</summary>
    private static double? MarginOf(IEnumerable<OrderItem> items)
    {
        var known = items.Where(i => i.Variant.UnitCost is not null).ToList();
        var revenue = known.Sum(i => i.Quantity * i.UnitPrice);
        return revenue == 0 ? null : (double)((revenue - known.Sum(i => i.Quantity * i.Variant.UnitCost!.Value)) / revenue);
    }
}
