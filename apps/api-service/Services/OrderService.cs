using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad: único escritor de <c>Orders</c>, <c>OrderItems</c> y <c>OrderStatusHistory</c> (DESIGN_DB §6).</summary>
public interface IOrderService
{
    /// <summary>Inserta el pedido con su folio. <c>false</c> si otra petición ya usó su <c>IdempotencyKey</c>.</summary>
    Task<bool> CreateAsync(Order order, CancellationToken cancellationToken = default);

    /// <summary>Guarda la referencia y, si se pagó, registra <c>PaidAt</c> y el hito <c>Pagado</c>.</summary>
    Task RecordPaymentAsync(Order order, string reference, bool paid, DateTime at, CancellationToken cancellationToken = default);

    Task<Order?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default);

    Task<Order?> FindByFolioAsync(string folio, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Order>> ListByUserAsync(int userId, int limit, CancellationToken cancellationToken = default);

    /// <summary>Pedidos OXXO sin pagar creados antes de <paramref name="cutoff"/>.</summary>
    Task<IReadOnlyList<int>> ListExpiredOxxoAsync(DateTime cutoff, CancellationToken cancellationToken = default);

    /// <summary>Cancela si sigue sin pagar y devuelve sus líneas para liberar; <c>null</c> si ya no aplica.</summary>
    Task<IReadOnlyList<StockLine>?> CancelUnpaidOxxoAsync(int orderId, string note, DateTime at, CancellationToken cancellationToken = default);

    /// <summary>Registra el pago de un OXXO que sigue pendiente. <c>false</c> si ya no aplica.</summary>
    Task<bool> ConfirmOxxoPaymentAsync(string folio, DateTime at, CancellationToken cancellationToken = default);
}

public class OrderService(SokkoDbContext db) : IOrderService
{
    public const string StoreActor = "Tienda en línea";
    public const string OxxoActor = "OXXO Pay";
    public const string SystemActor = "Sistema";

    private const int SqlUniqueIndexViolation = 2601;
    private const int SqlUniqueConstraintViolation = 2627;

    private IQueryable<Order> WithDetails() =>
        db.Orders.AsNoTracking().Include(o => o.Items).Include(o => o.StatusHistory).AsSplitQuery();

    public async Task<bool> CreateAsync(Order order, CancellationToken cancellationToken = default)
    {
        db.Orders.Add(order);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException ex) when (order.IdempotencyKey is not null
            && ex.InnerException is SqlException { Number: SqlUniqueIndexViolation or SqlUniqueConstraintViolation } sql
            && sql.Message.Contains("UQ_Orders_IdempotencyKey"))
        {
            return false;
        }
    }

    public async Task RecordPaymentAsync(Order order, string reference, bool paid, DateTime at, CancellationToken cancellationToken = default)
    {
        order.PaymentReference = reference;
        if (paid)
        {
            order.PaymentStatus = PaymentStatus.Pagado;
            order.PaidAt = at;
            order.StatusHistory.Add(History(OrderStatus.Pagado, at, StoreActor));
        }
        else
        {
            order.StatusHistory.Add(History(OrderStatus.PorPreparar, at, StoreActor));
        }
        order.UpdatedAt = at;
        await db.SaveChangesAsync(cancellationToken);
    }

    public Task<Order?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default) =>
        WithDetails().FirstOrDefaultAsync(o => o.IdempotencyKey == key, cancellationToken);

    public Task<Order?> FindByFolioAsync(string folio, CancellationToken cancellationToken = default) =>
        WithDetails().FirstOrDefaultAsync(o => o.Folio == folio, cancellationToken);

    public async Task<IReadOnlyList<Order>> ListByUserAsync(int userId, int limit, CancellationToken cancellationToken = default) =>
        await WithDetails()
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .ThenByDescending(o => o.Id)
            .Take(limit)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<int>> ListExpiredOxxoAsync(DateTime cutoff, CancellationToken cancellationToken = default) =>
        await db.Orders
            .AsNoTracking()
            .Where(o => o.PaymentMethod == PaymentMethod.OxxoPay
                && o.PaymentStatus == PaymentStatus.Pendiente
                && o.Status == OrderStatus.PorPreparar
                && o.CreatedAt <= cutoff)
            .Select(o => o.Id)
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<StockLine>?> CancelUnpaidOxxoAsync(int orderId, string note, DateTime at, CancellationToken cancellationToken = default)
    {
        // Condicionado: si el pago llegó primero, no se cancela.
        var rows = await db.Orders
            .Where(o => o.Id == orderId && o.PaymentStatus == PaymentStatus.Pendiente && o.Status == OrderStatus.PorPreparar)
            .ExecuteUpdateAsync(u => u.SetProperty(o => o.Status, OrderStatus.Cancelado).SetProperty(o => o.UpdatedAt, at), cancellationToken);
        if (rows != 1)
        {
            return null;
        }

        db.OrderStatusHistory.Add(new OrderStatusHistory
        {
            OrderId = orderId, Status = OrderStatus.Cancelado, ChangedAt = at, ChangedByName = SystemActor, Note = note,
        });
        await db.SaveChangesAsync(cancellationToken);
        return await db.OrderItems
            .AsNoTracking()
            .Where(i => i.OrderId == orderId)
            .Select(i => new StockLine(i.VariantId, i.Quantity))
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> ConfirmOxxoPaymentAsync(string folio, DateTime at, CancellationToken cancellationToken = default)
    {
        var orderId = await db.Orders
            .Where(o => o.Folio == folio && o.PaymentMethod == PaymentMethod.OxxoPay && o.PaymentStatus == PaymentStatus.Pendiente && o.Status == OrderStatus.PorPreparar)
            .Select(o => (int?)o.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (orderId is null)
        {
            return false;
        }

        var rows = await db.Orders
            .Where(o => o.Id == orderId && o.PaymentStatus == PaymentStatus.Pendiente && o.Status == OrderStatus.PorPreparar)
            .ExecuteUpdateAsync(u => u
                .SetProperty(o => o.PaymentStatus, PaymentStatus.Pagado)
                .SetProperty(o => o.PaidAt, at)
                .SetProperty(o => o.UpdatedAt, at), cancellationToken);
        if (rows != 1)
        {
            return false;
        }

        db.OrderStatusHistory.Add(new OrderStatusHistory
        {
            OrderId = orderId.Value, Status = OrderStatus.Pagado, ChangedAt = at, ChangedByName = OxxoActor,
        });
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static OrderStatusHistory History(OrderStatus status, DateTime at, string actor) =>
        new() { Status = status, ChangedAt = at, ChangedByName = actor };
}
