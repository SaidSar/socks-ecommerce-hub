using System.Globalization;
using System.Text.RegularExpressions;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Por qué un código no aplica: <see cref="Reason"/> es el código de API y <see cref="Message"/> el texto para el cliente.</summary>
public record CouponRejection(string Reason, string Message);

/// <summary>Cupón que aplica, o el motivo por el que no.</summary>
public record CouponLookup(Coupon? Coupon, CouponRejection? Rejection)
{
    public static CouponLookup Applies(Coupon coupon) => new(coupon, null);

    public static CouponLookup Rejected(CouponRejection rejection) => new(null, rejection);
}

/// <summary>
/// Reglas puras de los cupones (D-40). Las usan la cotización de la tienda, el checkout y el panel: un solo lugar decide
/// cuánto se descuenta y por qué un código no aplica.
/// </summary>
public static partial class CouponRules
{
    public const string NotFound = "not_found";
    public const string Inactive = "inactive";
    public const string NotStarted = "not_started";
    public const string Expired = "expired";
    public const string MinSubtotal = "min_subtotal";
    public const string Exhausted = "exhausted";
    public const string AlreadyUsed = "already_used";

    public const int MinPercent = 1;
    public const int MaxPercent = 90;

    private static readonly CultureInfo Mexico = CultureInfo.GetCultureInfo("es-MX");

    [GeneratedRegex("^[A-Z0-9-]{3,30}$")]
    private static partial Regex CodePattern();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Spaces();

    /// <summary>" bienvenida 10 " → "BIENVENIDA10". <c>null</c> si queda vacío.</summary>
    public static string? Normalize(string? code)
    {
        var normalized = Spaces().Replace(code ?? "", "").ToUpperInvariant();
        return normalized.Length == 0 ? null : normalized;
    }

    public static bool IsValidCode(string? code) => code is not null && CodePattern().IsMatch(code);

    /// <summary>Descuento sobre el subtotal de mercancía (ya con precios de oferta). Nunca lo deja en negativo ni toca el envío.</summary>
    public static decimal DiscountFor(Coupon? coupon, decimal subtotal) => coupon?.Type switch
    {
        CouponType.Percent => Math.Min(subtotal, Math.Round(subtotal * coupon.Value / 100m, 2, MidpointRounding.AwayFromZero)),
        CouponType.Fixed => Math.Min(coupon.Value, subtotal),
        _ => 0m,
    };

    /// <summary>"$500" o "$499.50".</summary>
    public static string Pesos(decimal amount) =>
        amount % 1 == 0 ? amount.ToString("$#,##0", Mexico) : amount.ToString("$#,##0.00", Mexico);

    /// <summary>"10 de noviembre"; con el año si no es el de <paramref name="today"/>.</summary>
    public static string Day(DateOnly day, DateOnly today) =>
        day.Year == today.Year ? day.ToString("d 'de' MMMM", Mexico) : day.ToString("d 'de' MMMM 'de' yyyy", Mexico);

    /// <summary>Texto para el cliente: "10% de descuento", "$100 de descuento", "Envío gratis".</summary>
    public static string PublicDescription(Coupon coupon) => coupon.Type switch
    {
        CouponType.Percent => $"{coupon.Value:0.##}% de descuento",
        CouponType.Fixed => $"{Pesos(coupon.Value)} de descuento",
        _ => "Envío gratis",
    };

    public static CouponRejection NotFoundRejection { get; } = new(NotFound, "Este código no existe.");

    /// <summary>
    /// <c>null</c> si aplica. El orden importa: primero lo que el cliente no puede cambiar (vigencia, usos) y al final el mínimo,
    /// que sí puede alcanzar agregando piezas. <paramref name="usedByEmail"/> es <c>null</c> si aún no se conoce el correo.
    /// </summary>
    public static CouponRejection? Check(Coupon coupon, DateOnly today, decimal subtotal, int redemptions, bool? usedByEmail)
    {
        if (!coupon.IsActive)
        {
            return new(Inactive, "Este código ya no está disponible.");
        }
        if (coupon.StartsOn is { } starts && today < starts)
        {
            return new(NotStarted, $"Este código es válido a partir del {Day(starts, today)}.");
        }
        if (coupon.EndsOn is { } ends && today > ends)
        {
            return new(Expired, $"Este código venció el {Day(ends, today)}.");
        }
        if (coupon.MaxRedemptions is { } max && redemptions >= max)
        {
            return new(Exhausted, "Este código ya se agotó.");
        }
        if (coupon.OnePerCustomer && usedByEmail == true)
        {
            return new(AlreadyUsed, "Este código ya se usó con su correo.");
        }
        if (coupon.MinSubtotal is { } min && subtotal < min)
        {
            return new(MinSubtotal, $"Este código aplica en compras desde {Pesos(min)}.");
        }
        return null;
    }

    /// <summary>Estado para el panel: inactivo, vencido, agotado, programado o activo.</summary>
    public static string StatusOf(Coupon coupon, DateOnly today, int redemptions) =>
        !coupon.IsActive ? "inactive"
        : coupon.EndsOn is { } ends && today > ends ? "expired"
        : coupon.MaxRedemptions is { } max && redemptions >= max ? "exhausted"
        : coupon.StartsOn is { } starts && today < starts ? "scheduled"
        : "active";
}
