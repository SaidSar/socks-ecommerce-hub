using Sokko.Api.Models.Enums;

namespace Sokko.Api.Models;

/// <summary>Cupón de descuento (DESIGN_DB §3.13a, D-40). Solo lo administra el Dueño (<c>promotions.manage</c>).</summary>
public class Coupon
{
    public int Id { get; set; }
    /// <summary>En mayúsculas y sin espacios: 3–30 caracteres <c>A-Z0-9-</c>.</summary>
    public string Code { get; set; } = null!;
    /// <summary>Nota interna del Dueño; nunca sale a la tienda.</summary>
    public string? Description { get; set; }
    public CouponType Type { get; set; }
    /// <summary>Porcentaje 1–90, monto fijo &gt; 0, o 0 para envío gratis.</summary>
    public decimal Value { get; set; }
    /// <summary>Subtotal de mercancía mínimo (con precios de oferta, antes del descuento).</summary>
    public decimal? MinSubtotal { get; set; }
    /// <summary>Primer día local (Los Mochis) en que vale, inclusivo.</summary>
    public DateOnly? StartsOn { get; set; }
    /// <summary>Último día local en que vale, inclusivo: a las 23:59 de ese día todavía aplica.</summary>
    public DateOnly? EndsOn { get; set; }
    /// <summary>Usos totales permitidos; <c>null</c> = sin límite.</summary>
    public int? MaxRedemptions { get; set; }
    /// <summary>Un uso por correo normalizado (invitados y cuentas).</summary>
    public bool OnePerCustomer { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public byte[] RowVersion { get; set; } = null!;

    public ICollection<CouponRedemption> Redemptions { get; set; } = [];
}

/// <summary>Uso de un cupón por un pedido vivo. Se borra al cancelar el pedido para liberar el uso (D-40).</summary>
public class CouponRedemption
{
    public int Id { get; set; }
    public int CouponId { get; set; }
    public int OrderId { get; set; }
    /// <summary>Correo normalizado del pedido, para <see cref="Coupon.OnePerCustomer"/>.</summary>
    public string CustomerEmail { get; set; } = null!;
    public decimal DiscountAmount { get; set; }
    public DateTime CreatedAt { get; set; }

    public Coupon Coupon { get; set; } = null!;
    public Order Order { get; set; } = null!;
}
