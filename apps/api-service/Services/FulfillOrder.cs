using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

public record TransitionCommand(string Folio, OrderStatus Target, string? Carrier, string? Tracking, string? Courier, byte[]? RowVersion, StaffActor Actor);

/// <summary>Servicio de tarea: surte o cancela el pedido en una sola transacción (R-09 a R-12, R-25 y DESIGN_DB §4.1).</summary>
public interface IFulfillOrder
{
    Task<AdminResult<AdminOrderView>> AdvanceAsync(TransitionCommand command, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminOrderView>> CancelAsync(string folio, string? note, byte[]? rowVersion, StaffActor actor, CancellationToken cancellationToken = default);
}

public class FulfillOrder(
    IUnitOfWork unitOfWork,
    IOrderAdminService orders,
    IInventoryService inventory,
    IPaymentGateway gateway,
    IClock clock,
    ILogger<FulfillOrder> logger) : IFulfillOrder
{
    private const string InconsistentReserved = "Las unidades apartadas de este pedido no cuadran. Revise el inventario antes de continuar.";

    private static AdminResult<AdminOrderView>? CheckVersion(Order? order, byte[]? rowVersion)
    {
        if (rowVersion is null)
        {
            return AdminResult<AdminOrderView>.Invalid(new Dictionary<string, string> { ["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage });
        }
        if (order is null)
        {
            return AdminResult<AdminOrderView>.NotFound(OrderAdminService.NotFoundMessage);
        }
        return order.RowVersion.SequenceEqual(rowVersion) ? null : AdminResult<AdminOrderView>.Conflict(ConcurrencyExceptionFilter.StaleMessage);
    }

    /// <summary>
    /// Sin apartado que descontar: lo normal es que otra persona ganara la carrera con este mismo pedido (R-25). Si el pedido
    /// sigue igual, los apartados de verdad no cuadran y queda registrado para revisión (DESIGN_DB §4.1).
    /// </summary>
    private async Task<AdminResult<AdminOrderView>> ReservedFailureAsync(Order order, byte[] rowVersion, CancellationToken cancellationToken)
    {
        if (await orders.HasChangedAsync(order.Id, rowVersion, cancellationToken))
        {
            return AdminResult<AdminOrderView>.Conflict(ConcurrencyExceptionFilter.StaleMessage);
        }
        logger.LogError("Apartados inconsistentes en el pedido {Folio}.", order.Folio);
        return AdminResult<AdminOrderView>.Conflict(InconsistentReserved);
    }

    private static List<StockLine> LinesOf(Order order) => order.Items.Select(i => new StockLine(i.VariantId, i.Quantity)).ToList();

    public async Task<AdminResult<AdminOrderView>> AdvanceAsync(TransitionCommand command, CancellationToken cancellationToken = default)
    {
        var failure = await unitOfWork.InTransactionAsync<AdminResult<AdminOrderView>?>(async ct =>
        {
            var result = await AdvanceInTransactionAsync(command, ct);
            return (result, result is null);
        }, cancellationToken);

        return failure ?? AdminResult<AdminOrderView>.Ok((await orders.GetAsync(command.Folio, cancellationToken))!);
    }

    private async Task<AdminResult<AdminOrderView>?> AdvanceInTransactionAsync(TransitionCommand command, CancellationToken cancellationToken)
    {
        var order = await orders.FindForUpdateAsync(command.Folio, cancellationToken);
        if (CheckVersion(order, command.RowVersion) is { } stale)
        {
            return stale;
        }

        if (OrderStateMachine.CheckTransition(order!.Status, order.DeliveryMethod, order.PaymentStatus, command.Target) is { } refused)
        {
            return AdminResult<AdminOrderView>.Conflict(refused);
        }

        var now = clock.UtcNow;
        Shipment? shipment = null;
        if (OrderStateMachine.LeavesWarehouse(command.Target))
        {
            var errors = OrderStateMachine.ValidateShipment(order.DeliveryMethod, command.Carrier, command.Tracking, command.Courier);
            if (errors.Count > 0)
            {
                return AdminResult<AdminOrderView>.Invalid(errors);
            }

            shipment = await orders.BuildShipmentAsync(order, command.Carrier, command.Tracking, command.Courier, now, cancellationToken);
            if (!await inventory.ShipAsync(LinesOf(order), order.Id, $"Pedido {order.Folio}", command.Actor, now, cancellationToken))
            {
                return await ReservedFailureAsync(order, command.RowVersion!, cancellationToken);
            }
        }

        await orders.ApplyStatusAsync(order, command.Target, command.RowVersion!, shipment, null, command.Actor, now, cancellationToken);
        return null;
    }

    public async Task<AdminResult<AdminOrderView>> CancelAsync(string folio, string? note, byte[]? rowVersion, StaffActor actor, CancellationToken cancellationToken = default)
    {
        string? refund = null;
        var failure = await unitOfWork.InTransactionAsync<AdminResult<AdminOrderView>?>(async ct =>
        {
            var order = await orders.FindForUpdateAsync(folio, ct);
            if (CheckVersion(order, rowVersion) is { } stale)
            {
                return (stale, false);
            }
            if (!OrderStateMachine.CanCancel(order!.Status))
            {
                return (AdminResult<AdminOrderView>.Conflict(OrderStateMachine.CannotCancel), false);
            }

            if (!await inventory.TryReleaseAsync(LinesOf(order), ct))
            {
                return (await ReservedFailureAsync(order, rowVersion!, ct), false);
            }

            refund = order.PaymentStatus == PaymentStatus.Pagado ? order.PaymentReference : null;
            await orders.ApplyStatusAsync(order, OrderStatus.Cancelado, rowVersion!, null, note, actor, clock.UtcNow, ct);
            return ((AdminResult<AdminOrderView>?)null, true);
        }, cancellationToken);

        if (failure is not null)
        {
            return failure;
        }

        if (refund is not null)
        {
            try
            {
                await gateway.VoidAsync(refund, CancellationToken.None);
            }
            catch (Exception ex)
            {
                // El pedido ya se canceló y liberó lo apartado: el reembolso se atiende a mano con la referencia.
                logger.LogError(ex, "No se pudo anular el cobro {Reference} del pedido {Folio}.", refund, folio);
            }
        }
        return AdminResult<AdminOrderView>.Ok((await orders.GetAsync(folio, cancellationToken))!);
    }
}
