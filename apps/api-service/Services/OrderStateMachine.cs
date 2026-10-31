using System.Text.RegularExpressions;
using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Máquina de estados del pedido (R-11 y R-12): las mismas reglas que <c>domain/orders.js</c> del panel, sin tocar datos.</summary>
public static partial class OrderStateMachine
{
    public const string NoNextStep = "Este pedido ya no tiene un siguiente paso.";
    public const string WrongStep = "Ese no es el siguiente paso de este pedido. Recargue la página y vuelva a intentarlo.";
    public const string PaymentPending = "El pago en OXXO sigue pendiente. El pedido se prepara cuando llegue la confirmación.";
    public const string CannotCancel = "Solo se cancelan pedidos por preparar o en preparación.";
    public const string CarrierError = "Elija la paquetería.";
    public const string TrackingError = "Escriba el número de guía (solo dígitos, mínimo 10).";
    public const string CourierError = "Elija quién lleva el pedido.";

    private const int MaxTrackingLength = 30;
    private const int MaxCourierLength = 80;

    [GeneratedRegex("^[0-9]{10,}$")]
    private static partial Regex TrackingPattern();

    /// <summary>Estado siguiente según el método de entrega; <c>null</c> si el pedido ya no avanza.</summary>
    public static OrderStatus? Next(OrderStatus status, DeliveryMethod delivery) => status switch
    {
        OrderStatus.PorPreparar => OrderStatus.Preparando,
        OrderStatus.Preparando => delivery == DeliveryMethod.Local ? OrderStatus.EnRuta : OrderStatus.Enviado,
        OrderStatus.Enviado or OrderStatus.EnRuta => OrderStatus.Entregado,
        _ => null,
    };

    public static bool CanCancel(OrderStatus status) => status is OrderStatus.PorPreparar or OrderStatus.Preparando;

    /// <summary>¿Este paso saca el pedido de bodega? Entonces descuenta stock y crea el envío (R-09).</summary>
    public static bool LeavesWarehouse(OrderStatus target) => target is OrderStatus.Enviado or OrderStatus.EnRuta;

    /// <summary>Por qué no se puede pasar a <paramref name="target"/>; <c>null</c> si se puede.</summary>
    public static string? CheckTransition(OrderStatus status, DeliveryMethod delivery, PaymentStatus payment, OrderStatus target)
    {
        if (Next(status, delivery) is not { } next)
        {
            return NoNextStep;
        }
        if (target != next)
        {
            return WrongStep;
        }
        // CK_Orders_PaymentBeforeFulfillment: sin pago solo se puede estar por preparar o cancelado.
        return payment == PaymentStatus.Pagado ? null : PaymentPending;
    }

    /// <summary>R-12: paquetería con guía, o repartidor en local. Solo importa lo que corresponde al método de entrega.</summary>
    public static Dictionary<string, string> ValidateShipment(DeliveryMethod delivery, string? carrier, string? tracking, string? courier)
    {
        var errors = new Dictionary<string, string>();
        if (delivery == DeliveryMethod.Local)
        {
            if (string.IsNullOrWhiteSpace(courier) || courier.Trim().Length > MaxCourierLength)
            {
                errors["courier"] = CourierError;
            }
            return errors;
        }

        if (CarrierCodes.Parse(carrier) is null)
        {
            errors["carrier"] = CarrierError;
        }
        var guide = tracking?.Trim() ?? "";
        if (!TrackingPattern().IsMatch(guide) || guide.Length > MaxTrackingLength)
        {
            errors["tracking"] = TrackingError;
        }
        return errors;
    }
}
