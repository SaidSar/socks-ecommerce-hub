namespace Sokko.Api.Models.Enums;

/// <summary>
/// Estado operativo del pedido (`Orders.Status`) y de su línea de tiempo (`OrderStatusHistory.Status`).
/// <see cref="Pagado"/> solo existe en el historial: es el hito que se escribe al registrar `Orders.PaidAt` (DESIGN_DB §3.10).
/// </summary>
public enum OrderStatus
{
    PorPreparar,
    Preparando,
    Enviado,
    EnRuta,
    Entregado,
    Cancelado,
    Pagado,
}
