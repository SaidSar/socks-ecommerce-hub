namespace Sokko.Api.Models.Enums;

/// <summary>Estado del pago (`Orders.PaymentStatus`). Tarjeta nace <see cref="Pagado"/>; OXXO Pay nace <see cref="Pendiente"/> (P-03).</summary>
public enum PaymentStatus
{
    Pendiente,
    Pagado,
    Reembolsado,
}
