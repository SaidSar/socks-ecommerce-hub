using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>
/// Definiciones de venta que comparten el Dashboard y Reportes, para que los dos den los mismos números: una venta es un
/// pedido pagado y sin cancelar (un OXXO pendiente todavía no lo es), y cuenta en el día local en que se hizo el pedido.
/// </summary>
public static class SalesFigures
{
    public static readonly Expression<Func<Order, bool>> IsSale = o => o.Status != OrderStatus.Cancelado && o.PaymentStatus == PaymentStatus.Pagado;

    /// <summary>Pedidos creados en los días locales <paramref name="from"/> a <paramref name="to"/> (inclusivos).</summary>
    public static IQueryable<Order> CreatedBetween(IQueryable<Order> orders, DateOnly from, DateOnly to)
    {
        var (fromUtc, toUtc) = BusinessTime.RangeUtc(from, to);
        return orders.Where(o => o.CreatedAt >= fromUtc && o.CreatedAt < toUtc);
    }

    /// <summary>Ventas del periodo con sus líneas, variante, producto y marca.</summary>
    public static Task<List<Order>> LoadSalesAsync(SokkoDbContext db, DateOnly from, DateOnly to, CancellationToken cancellationToken) =>
        CreatedBetween(db.Orders.AsNoTracking(), from, to)
            .Where(IsSale)
            .Include(o => o.Items).ThenInclude(i => i.Variant).ThenInclude(v => v.Product).ThenInclude(p => p.Brand)
            .AsSplitQuery()
            .ToListAsync(cancellationToken);

    /// <summary>Variación en %; <c>null</c> si no hay base para comparar.</summary>
    public static double? PercentChange(decimal current, decimal previous) =>
        previous == 0 ? null : (double)((current - previous) / previous) * 100;

    /// <inheritdoc cref="PercentChange(decimal, decimal)"/>
    public static double? PercentChange(double current, double previous) =>
        previous == 0 ? null : (current - previous) / previous * 100;

    /// <summary>Ticket promedio redondeado a centavos.</summary>
    public static decimal Ticket(decimal total, int count) =>
        count == 0 ? 0 : Math.Round(total / count, 2, MidpointRounding.AwayFromZero);
}
