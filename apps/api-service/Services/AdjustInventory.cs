using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Mensajes de inventario: los mismos que <c>domain/inventory.js</c>. <c>unit</c> es la del renglón (DESIGN_CATALOG_UI §4.7).</summary>
public static class InventoryMessages
{
    public const string Quantity = "Escriba una cantidad mayor a 0.";
    public const string Note = "Escriba el motivo para la bitácora.";
    public const string Folio = "Escriba el folio del pedido, por ejemplo SKK-1042.";
    public const string Type = "Tipo de movimiento no válido.";

    private static string CountText(int n, string unit) => unit == "par" ? (n == 1 ? "1 par" : $"{n} pares") : n == 1 ? "1 unidad" : $"{n} unidades";

    private static string ReservedCount(int n, string unit)
    {
        var word = unit == "par" ? "apartado" : "apartada";
        return n == 1 ? $"1 está {word}" : $"{n} están {word}s";
    }

    public static string ReservedText(int n, string unit) => unit == "par"
        ? (n == 1 ? "el par apartado" : $"los {n} pares apartados")
        : n == 1 ? "la unidad apartada" : $"las {n} unidades apartadas";

    public static string Count(string unit) => unit == "par" ? "Escriba cuántos pares contó (0 o más)." : "Escriba cuántas unidades contó (0 o más).";

    public static string TooMany(int n, string unit) => $"No puede sacar más de {CountText(n, unit)}.";

    public static string TooManyReserved(int n, int reserved, string unit) => $"No puede sacar más de {CountText(n, unit)}; {ReservedCount(reserved, unit)} para pedidos.";

    public static string BelowReserved(int n, int reserved, string unit) => $"El conteo ({n}) es menor que {ReservedText(reserved, unit)}. Cancele o surta esos pedidos antes de ajustar.";

    public static string FolioUnknown(string folio) => $"No encontramos el pedido {folio}. Revise el folio.";

    public static string FolioWithoutSku(string folio) => $"El pedido {folio} no lleva este SKU. Revise el folio.";

    public static string FolioNotShipped(string folio) => $"El pedido {folio} todavía no sale de bodega: no puede haber devolución.";
}

public record AdjustCommand(string Sku, InventoryMovementType? Type, int? Qty, string? Note, string? Folio, byte[]? RowVersion, StaffActor Actor);

/// <summary>Servicio de tarea: movimiento manual del kárdex con R-18 y R-27. El stock y el movimiento van en una transacción (R-19).</summary>
public interface IAdjustInventory
{
    Task<AdminResult<InventoryAdjustmentDto>> ApplyAsync(AdjustCommand command, CancellationToken cancellationToken = default);
}

public class AdjustInventory(
    IUnitOfWork unitOfWork,
    IInventoryService inventory,
    IInventoryAdminService queries,
    IOrderAdminService orders,
    IClock clock) : IAdjustInventory
{
    private const string CountNote = "Ajuste tras conteo";

    private static AdminResult<InventoryAdjustmentDto> Field(string field, string message) =>
        AdminResult<InventoryAdjustmentDto>.Invalid(new Dictionary<string, string> { [field] = message });

    /// <summary>Stock que deja el movimiento, o el error por campo.</summary>
    private static (int NewStock, AdminResult<InventoryAdjustmentDto>? Failure) NewStock(InventoryRowDto row, InventoryMovementType type, int? qty)
    {
        if (type == InventoryMovementType.ConteoFisico)
        {
            if (qty is not >= 0)
            {
                return (0, Field("qty", InventoryMessages.Count(row.Unit)));
            }
            // R-27: el conteo no puede quedar por debajo de lo apartado.
            return qty < row.Reserved ? (0, Field("qty", InventoryMessages.BelowReserved(qty.Value, row.Reserved, row.Unit))) : (qty.Value, null);
        }

        if (qty is not > 0)
        {
            return (0, Field("qty", InventoryMessages.Quantity));
        }
        if (type != InventoryMovementType.Merma)
        {
            return (row.Stock + qty.Value, null);
        }
        // R-27: la merma no puede tocar lo apartado.
        if (qty > row.Available)
        {
            return (0, Field("qty", row.Reserved > 0 ? InventoryMessages.TooManyReserved(row.Available, row.Reserved, row.Unit) : InventoryMessages.TooMany(row.Stock, row.Unit)));
        }
        return (row.Stock - qty.Value, null);
    }

    public async Task<AdminResult<InventoryAdjustmentDto>> ApplyAsync(AdjustCommand command, CancellationToken cancellationToken = default)
    {
        if (command.Type is not (InventoryMovementType.Entrada or InventoryMovementType.Merma or InventoryMovementType.Devolucion or InventoryMovementType.ConteoFisico))
        {
            return Field("type", InventoryMessages.Type);
        }
        if (command.RowVersion is null)
        {
            return Field("rowVersion", ConcurrencyExceptionFilter.StaleMessage);
        }
        var row = await queries.GetAsync(command.Sku, cancellationToken);
        if (row is null)
        {
            return AdminResult<InventoryAdjustmentDto>.NotFound("El SKU no existe en el catálogo.");
        }
        if (!row.RowVersion.SequenceEqual(command.RowVersion))
        {
            return AdminResult<InventoryAdjustmentDto>.Conflict(ConcurrencyExceptionFilter.StaleMessage);
        }

        var type = command.Type.Value;
        var (newStock, failure) = NewStock(row, type, command.Qty);
        if (failure is not null)
        {
            return failure;
        }

        var note = string.IsNullOrWhiteSpace(command.Note) ? null : command.Note.Trim();
        if (note is null && type is InventoryMovementType.Merma or InventoryMovementType.Devolucion)
        {
            return Field("note", InventoryMessages.Note);
        }

        int? orderId = null;
        if (type == InventoryMovementType.Devolucion)
        {
            var folio = command.Folio?.Trim().ToUpperInvariant();
            if (string.IsNullOrEmpty(folio))
            {
                return Field("folio", InventoryMessages.Folio);
            }
            var order = await orders.FindForUpdateAsync(folio, cancellationToken);
            if (order is null)
            {
                return Field("folio", InventoryMessages.FolioUnknown(folio));
            }
            if (!order.Items.Any(i => i.SkuSnapshot == row.Sku))
            {
                return Field("folio", InventoryMessages.FolioWithoutSku(folio));
            }
            if (order.Status is not (OrderStatus.Enviado or OrderStatus.EnRuta or OrderStatus.Entregado))
            {
                return Field("folio", InventoryMessages.FolioNotShipped(folio));
            }
            orderId = order.Id;
        }
        note ??= type == InventoryMovementType.ConteoFisico ? CountNote : null;

        var variantId = await inventory.FindVariantIdAsync(row.Sku, cancellationToken);
        var applied = await unitOfWork.InTransactionAsync(async ct =>
        {
            var done = await inventory.SetStockAsync(new StockChange(variantId, newStock, newStock - row.Stock, command.RowVersion, type, note, orderId), command.Actor, clock.UtcNow, ct);
            return (done, done);
        }, cancellationToken);
        if (!applied)
        {
            // Otra persona o una venta cambió la fila entre la lectura y este UPDATE.
            return AdminResult<InventoryAdjustmentDto>.Conflict(ConcurrencyExceptionFilter.StaleMessage);
        }

        var movements = await queries.ListMovementsAsync(row.Sku, cancellationToken);
        return AdminResult<InventoryAdjustmentDto>.Ok(new InventoryAdjustmentDto((await queries.GetAsync(row.Sku, cancellationToken))!, movements![0]));
    }
}
