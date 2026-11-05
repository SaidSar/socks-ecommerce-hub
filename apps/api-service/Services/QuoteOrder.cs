using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>
/// Cotización de un pedido. <c>FreeShippingRemaining</c> es lo que falta de mercancía (ya con descuento) para el envío de
/// cortesía; <c>null</c> si el envío ya es gratis o si en esa zona el umbral no aplica. Sin CP, <c>Method</c> y
/// <c>ShippingCost</c> son <c>null</c> y el total es solo la mercancía.
/// </summary>
public record OrderQuote(
    decimal Subtotal,
    decimal Discount,
    DeliveryMethod? Method,
    decimal? ShippingCost,
    decimal Total,
    decimal? FreeShippingRemaining);

/// <summary>
/// Servicio de tarea: la única fórmula del total (R-13, D-40). La usan el checkout y la vista previa del cupón, así la tienda
/// nunca muestra un número que el servidor no vaya a cobrar: <c>Total = Subtotal − Descuento + Envío</c>.
/// </summary>
public interface IQuoteOrder
{
    Task<OrderQuote> QuoteAsync(decimal subtotal, string? postalCode, Coupon? coupon, CancellationToken cancellationToken = default);
}

public class QuoteOrder(IQuoteShipping quoteShipping, ISettingsService settings) : IQuoteOrder
{
    /// <summary>Partidas del pedido con el precio efectivo de hoy (R-29). Las comparten el checkout y la vista previa.</summary>
    public static List<OrderItem> BuildItems(IEnumerable<CheckoutLine> lines, IReadOnlyDictionary<string, ProductVariant> variants, ICatalogService catalog, DateOnly today) =>
        lines.Where(l => variants.ContainsKey(l.Sku)).Select(line =>
        {
            var variant = variants[line.Sku];
            return new OrderItem
            {
                VariantId = variant.Id,
                SkuSnapshot = variant.Sku,
                ProductNameSnapshot = variant.Product.Name,
                ToneNameSnapshot = variant.Color.Name,
                SizeCodeSnapshot = variant.Size.Code,
                Quantity = line.Quantity,
                UnitPrice = catalog.GetEffectivePrice(variant.Product, today).FinalPrice,
            };
        }).ToList();

    /// <summary>Junta las líneas del mismo SKU (sin distinguir mayúsculas) en una sola.</summary>
    public static List<CheckoutLine> Merge(IEnumerable<CheckoutLine> lines) =>
        lines.GroupBy(i => i.Sku, StringComparer.OrdinalIgnoreCase)
            .Select(g => new CheckoutLine(g.Key.ToUpperInvariant(), g.Sum(i => i.Quantity)))
            .ToList();

    public async Task<OrderQuote> QuoteAsync(decimal subtotal, string? postalCode, Coupon? coupon, CancellationToken cancellationToken = default)
    {
        var discount = CouponRules.DiscountFor(coupon, subtotal);
        // El envío de cortesía se evalúa con lo que el cliente paga de mercancía: después del descuento.
        var merchandise = subtotal - discount;
        var config = await settings.GetConfigAsync(cancellationToken);
        var freeByCoupon = coupon?.Type == CouponType.FreeShipping;

        if (string.IsNullOrWhiteSpace(postalCode))
        {
            var pending = freeByCoupon ? (decimal?)null : Math.Max(0, config.FreeShippingThreshold - merchandise);
            return new OrderQuote(subtotal, discount, null, freeByCoupon ? 0m : null, merchandise, pending is > 0 ? pending : null);
        }

        var shipping = await quoteShipping.QuoteAsync(postalCode, merchandise, cancellationToken);
        var cost = freeByCoupon ? 0m : shipping.Cost;
        // En entrega local sin cortesía configurada, alcanzar el umbral no cambia nada: no se anuncia.
        var thresholdApplies = shipping.Method == DeliveryMethod.Paqueteria || config.LocalFreeShipping;
        decimal? remaining = cost > 0 && thresholdApplies ? Math.Max(0, config.FreeShippingThreshold - merchandise) : null;
        return new OrderQuote(subtotal, discount, shipping.Method, cost, merchandise + cost, remaining is > 0 ? remaining : null);
    }
}
