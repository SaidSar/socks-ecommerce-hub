using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

public record CheckoutLine(string Sku, int Quantity);

public record CheckoutCommand(
    int? UserId,
    string FirstName,
    string LastName,
    string Email,
    string Phone,
    string Street,
    string Neighborhood,
    string City,
    string State,
    string PostalCode,
    string? References,
    bool GiftWrap,
    PaymentMethod PaymentMethod,
    string? PaymentToken,
    decimal? ExpectedTotal,
    IReadOnlyList<CheckoutLine> Items,
    string? IdempotencyKey,
    /// <summary>Ya normalizado (mayúsculas, sin espacios). Forma parte del hash de idempotencia.</summary>
    string? CouponCode = null);

public record ShortageLine(string Sku, int Requested, int Available);

public abstract record CheckoutResult
{
    public sealed record Created(string Folio, bool Replayed) : CheckoutResult;

    public sealed record OutOfStock(IReadOnlyList<ShortageLine> Lines) : CheckoutResult;

    public sealed record PriceChanged(decimal Total) : CheckoutResult;

    /// <summary>El cupón dejó de aplicar entre la vista previa y la compra. <c>Total</c> es el total sin cupón.</summary>
    public sealed record CouponInvalid(string Reason, string Message, decimal Total) : CheckoutResult;

    public sealed record Declined(string Code) : CheckoutResult;

    public sealed record IdempotencyConflict : CheckoutResult;
}

/// <summary>Servicio de tarea: crea el pedido en una sola transacción y recalcula todo en el servidor (R-13, DESIGN_DB §4.1).</summary>
public interface ICheckoutOrder
{
    Task<CheckoutResult> PlaceAsync(CheckoutCommand command, CancellationToken cancellationToken = default);
}

public class CheckoutOrder(
    IUnitOfWork unitOfWork,
    IInventoryService inventory,
    IOrderService orders,
    ICatalogService catalog,
    ISettingsService settings,
    IQuoteOrder quoteOrder,
    ICouponService coupons,
    IPaymentGateway gateway,
    IOrderConfirmation confirmation,
    IClock clock) : ICheckoutOrder
{
    public async Task<CheckoutResult> PlaceAsync(CheckoutCommand command, CancellationToken cancellationToken = default)
    {
        // " bienvenida10 " y "BIENVENIDA10" son la misma compra para la idempotencia.
        command = command with { CouponCode = CouponRules.Normalize(command.CouponCode) };
        var hash = RequestHash(command);
        if (command.IdempotencyKey is not null)
        {
            var existing = await orders.FindByIdempotencyKeyAsync(command.IdempotencyKey, cancellationToken);
            if (existing is not null)
            {
                return Replay(existing, hash);
            }
        }

        // Si la conexión falla y se reintenta, la pasarela recibe la misma llave y no cobra dos veces.
        var gatewayKey = command.IdempotencyKey ?? Guid.NewGuid().ToString("N");
        string? approvedReference = null;

        try
        {
            var result = await unitOfWork.InTransactionAsync<CheckoutResult>(async ct =>
            {
                var attempt = await PlaceInTransactionAsync(command, hash, gatewayKey, reference => approvedReference = reference, ct);
                return (attempt, attempt is CheckoutResult.Created);
            }, cancellationToken);

            // Otra petición con la misma llave ganó la carrera: se responde con su pedido.
            if (result is CheckoutResult.IdempotencyConflict)
            {
                var winner = await orders.FindByIdempotencyKeyAsync(command.IdempotencyKey!, cancellationToken);
                return winner is null ? result : Replay(winner, hash);
            }
            // Ya confirmado: una repetición de la misma compra no vuelve a avisar.
            if (result is CheckoutResult.Created created)
            {
                await confirmation.SendAsync(created.Folio);
            }
            return result;
        }
        catch when (approvedReference is not null)
        {
            // El cobro se aprobó pero el pedido no se confirmó: no se queda con el dinero del cliente.
            await gateway.VoidAsync(approvedReference, CancellationToken.None);
            throw;
        }
    }

    private async Task<CheckoutResult> PlaceInTransactionAsync(
        CheckoutCommand command, byte[] hash, string gatewayKey, Action<string> onApproved, CancellationToken cancellationToken)
    {
        var requested = QuoteOrder.Merge(command.Items);
        var variants = (await inventory.GetForSaleAsync(requested.Select(l => l.Sku).ToList(), cancellationToken))
            .ToDictionary(v => v.Sku, StringComparer.OrdinalIgnoreCase);

        var missing = requested.Where(l => !variants.ContainsKey(l.Sku)).Select(l => new ShortageLine(l.Sku, l.Quantity, 0)).ToList();
        var shortages = await inventory.ReserveAsync(
            requested.Where(l => variants.ContainsKey(l.Sku)).Select(l => new StockLine(variants[l.Sku].Id, l.Quantity)),
            cancellationToken);
        if (missing.Count > 0 || shortages.Count > 0)
        {
            var skuById = variants.Values.ToDictionary(v => v.Id, v => v.Sku);
            return new CheckoutResult.OutOfStock([.. missing, .. shortages.Select(s => new ShortageLine(skuById[s.VariantId], s.Requested, s.Available))]);
        }

        var today = clock.Today;
        var now = clock.UtcNow;
        var items = QuoteOrder.BuildItems(requested, variants, catalog, today);
        var subtotal = items.Sum(i => i.Quantity * i.UnitPrice);

        // D-40: el cupón se vuelve a validar aquí, con su fila bloqueada hasta el COMMIT (usos totales y por correo).
        Coupon? coupon = null;
        if (command.CouponCode is not null)
        {
            var lookup = await coupons.FindApplicableAsync(command.CouponCode, subtotal, command.Email, forCheckout: true, cancellationToken);
            if (lookup.Rejection is { } rejection)
            {
                var without = await quoteOrder.QuoteAsync(subtotal, command.PostalCode, null, cancellationToken);
                return new CheckoutResult.CouponInvalid(rejection.Reason, rejection.Message, without.Total);
            }
            coupon = lookup.Coupon;
        }

        var quote = await quoteOrder.QuoteAsync(subtotal, command.PostalCode, coupon, cancellationToken);
        var total = quote.Total;
        if (command.ExpectedTotal is { } expected && expected != total)
        {
            return new CheckoutResult.PriceChanged(total);
        }

        var config = await settings.GetConfigAsync(cancellationToken);
        var order = new Order
        {
            UserId = command.UserId,
            CustomerFirstName = command.FirstName.Trim(),
            CustomerLastName = command.LastName.Trim(),
            CustomerEmail = UserService.NormalizeEmail(command.Email),
            CustomerPhone = command.Phone,
            ShipStreet = command.Street.Trim(),
            ShipNeighborhood = command.Neighborhood.Trim(),
            ShipCity = command.City.Trim(),
            ShipState = command.State.Trim(),
            ShipPostalCode = command.PostalCode,
            ShipReferences = string.IsNullOrWhiteSpace(command.References) ? null : command.References.Trim(),
            DeliveryMethod = quote.Method!.Value,
            PaymentMethod = command.PaymentMethod,
            Subtotal = subtotal,
            CouponCode = coupon?.Code,
            DiscountAmount = quote.Discount,
            ShippingCost = quote.ShippingCost!.Value,
            Total = total,
            TaxRate = config.IvaRate,
            GiftWrap = command.GiftWrap,
            CreatedAt = now,
            UpdatedAt = now,
            IdempotencyKey = command.IdempotencyKey,
            IdempotencyHash = command.IdempotencyKey is null ? null : hash,
            Items = items,
        };
        if (!await orders.CreateAsync(order, cancellationToken))
        {
            return new CheckoutResult.IdempotencyConflict();
        }
        if (coupon is not null)
        {
            await coupons.RedeemAsync(coupon.Id, order.Id, order.CustomerEmail, quote.Discount, now, cancellationToken);
        }

        var payment = await gateway.ChargeAsync(
            new PaymentRequest(command.PaymentMethod, total, command.PaymentToken, order.Folio, gatewayKey), cancellationToken);
        if (!payment.Approved)
        {
            return new CheckoutResult.Declined(payment.DeclineCode ?? PaymentDecline.Declined);
        }
        if (payment.Paid)
        {
            onApproved(payment.Reference!);
        }

        await orders.RecordPaymentAsync(order, payment.Reference!, payment.Paid, now, cancellationToken);
        return new CheckoutResult.Created(order.Folio, false);
    }

    private static CheckoutResult Replay(Order existing, byte[] hash) =>
        existing.IdempotencyHash is not null && CryptographicOperations.FixedTimeEquals(existing.IdempotencyHash, hash)
            ? new CheckoutResult.Created(existing.Folio, true)
            : new CheckoutResult.IdempotencyConflict();

    /// <summary>Los datos que definen la compra. El token no cuenta: una pasarela real emite uno distinto en cada intento.</summary>
    private static byte[] RequestHash(CheckoutCommand command) =>
        SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(command with { PaymentToken = null, ExpectedTotal = null, IdempotencyKey = null })));
}
