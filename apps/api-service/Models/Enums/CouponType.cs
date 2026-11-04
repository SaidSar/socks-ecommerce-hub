namespace Sokko.Api.Models.Enums;

/// <summary>Tipo de cupón (`Coupons.Type`). En la API: <c>percent</c>, <c>fixed</c> y <c>free_shipping</c>.</summary>
public enum CouponType
{
    /// <summary>Porcentaje del subtotal de mercancía (1–90).</summary>
    Percent,
    /// <summary>Monto fijo en pesos, nunca mayor que el subtotal.</summary>
    Fixed,
    /// <summary>El envío queda en $0 (paquetería y local).</summary>
    FreeShipping,
}
