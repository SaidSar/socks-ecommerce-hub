namespace Sokko.Api.Services;

/// <summary>Servicio de tarea: cancela los pedidos OXXO sin pagar y libera lo apartado (P-03, R-10).</summary>
public interface IExpireOxxoOrders
{
    TimeSpan Lifetime { get; }

    /// <summary>Devuelve cuántos pedidos canceló.</summary>
    Task<int> RunAsync(CancellationToken cancellationToken = default);
}

public class ExpireOxxoOrders(IUnitOfWork unitOfWork, IOrderService orders, IInventoryService inventory, IClock clock, IConfiguration configuration) : IExpireOxxoOrders
{
    public const string ExpiredNote = "Referencia OXXO vencida";

    public TimeSpan Lifetime => TimeSpan.FromHours(configuration.GetValue("Orders:OxxoExpiryHours", 72));

    public async Task<int> RunAsync(CancellationToken cancellationToken = default)
    {
        var now = clock.UtcNow;
        var cancelled = 0;
        foreach (var orderId in await orders.ListExpiredOxxoAsync(now - Lifetime, cancellationToken))
        {
            // Cada pedido en su transacción: uno con problemas no detiene a los demás en la siguiente vuelta.
            var done = await unitOfWork.InTransactionAsync(async ct =>
            {
                var lines = await orders.CancelUnpaidOxxoAsync(orderId, ExpiredNote, now, ct);
                if (lines is null)
                {
                    return (false, false);
                }
                await inventory.ReleaseAsync(lines, ct);
                return (true, true);
            }, cancellationToken);
            cancelled += done ? 1 : 0;
        }
        return cancelled;
    }
}

/// <summary>Corre <see cref="IExpireOxxoOrders"/> cada <c>Orders:OxxoExpiryCheckMinutes</c>.</summary>
public class OxxoExpiryJob(IServiceScopeFactory scopes, IConfiguration configuration, ILogger<OxxoExpiryJob> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!configuration.GetValue("Orders:OxxoExpiryJobEnabled", true))
        {
            return;
        }

        var interval = TimeSpan.FromMinutes(configuration.GetValue("Orders:OxxoExpiryCheckMinutes", 5));
        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var cancelled = await scope.ServiceProvider.GetRequiredService<IExpireOxxoOrders>().RunAsync(stoppingToken);
                if (cancelled > 0)
                {
                    logger.LogInformation("Pedidos OXXO vencidos y cancelados: {Count}", cancelled);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Falló el vencimiento de pedidos OXXO; se reintenta en la siguiente vuelta.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
