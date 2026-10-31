using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class OrderStateMachineTests
{
    private static readonly OrderStatus[] States = [OrderStatus.PorPreparar, OrderStatus.Preparando, OrderStatus.Enviado, OrderStatus.EnRuta, OrderStatus.Entregado, OrderStatus.Cancelado];

    /// <summary>La tabla de DESIGN_ADMIN §5.1, escrita aparte de la implementación: (desde, método) → siguiente.</summary>
    private static OrderStatus? Expected(OrderStatus from, DeliveryMethod delivery) => (from, delivery) switch
    {
        (OrderStatus.PorPreparar, _) => OrderStatus.Preparando,
        (OrderStatus.Preparando, DeliveryMethod.Paqueteria) => OrderStatus.Enviado,
        (OrderStatus.Preparando, DeliveryMethod.Local) => OrderStatus.EnRuta,
        (OrderStatus.Enviado, _) => OrderStatus.Entregado,
        (OrderStatus.EnRuta, _) => OrderStatus.Entregado,
        _ => null,
    };

    public static TheoryData<OrderStatus, DeliveryMethod, PaymentStatus, OrderStatus> AllCombinations()
    {
        var data = new TheoryData<OrderStatus, DeliveryMethod, PaymentStatus, OrderStatus>();
        foreach (var from in States)
        {
            foreach (var delivery in Enum.GetValues<DeliveryMethod>())
            {
                foreach (var payment in Enum.GetValues<PaymentStatus>())
                {
                    foreach (var target in Enum.GetValues<OrderStatus>())
                    {
                        data.Add(from, delivery, payment, target);
                    }
                }
            }
        }
        return data;
    }

    [Theory]
    [MemberData(nameof(AllCombinations))]
    public void Every_transition_is_accepted_or_refused_as_the_table_says(OrderStatus from, DeliveryMethod delivery, PaymentStatus payment, OrderStatus target)
    {
        var result = OrderStateMachine.CheckTransition(from, delivery, payment, target);
        var next = Expected(from, delivery);

        if (next is null)
        {
            Assert.Equal(OrderStateMachine.NoNextStep, result);
        }
        else if (target != next)
        {
            Assert.Equal(OrderStateMachine.WrongStep, result);
        }
        else if (payment != PaymentStatus.Pagado)
        {
            Assert.Equal(OrderStateMachine.PaymentPending, result);
        }
        else
        {
            Assert.Null(result);
        }
    }

    [Theory]
    [InlineData(OrderStatus.PorPreparar, true)]
    [InlineData(OrderStatus.Preparando, true)]
    [InlineData(OrderStatus.Enviado, false)]
    [InlineData(OrderStatus.EnRuta, false)]
    [InlineData(OrderStatus.Entregado, false)]
    [InlineData(OrderStatus.Cancelado, false)]
    public void Only_orders_in_the_warehouse_can_be_cancelled(OrderStatus status, bool expected) =>
        Assert.Equal(expected, OrderStateMachine.CanCancel(status));

    [Theory]
    [InlineData(OrderStatus.Enviado, true)]
    [InlineData(OrderStatus.EnRuta, true)]
    [InlineData(OrderStatus.Preparando, false)]
    [InlineData(OrderStatus.Entregado, false)]
    public void Stock_leaves_only_when_the_order_leaves(OrderStatus target, bool expected) =>
        Assert.Equal(expected, OrderStateMachine.LeavesWarehouse(target));

    [Theory]
    [InlineData("estafeta", "1234567890", null)]
    [InlineData("dhl_express", " 123456789012 ", null)]
    [InlineData("fedex", "1234567890", "carrier")]
    [InlineData(null, "1234567890", "carrier")]
    [InlineData("estafeta", "123456789", "tracking")]
    [InlineData("estafeta", "12345abc90", "tracking")]
    [InlineData("estafeta", "١٢٣٤٥٦٧٨٩٠", "tracking")]
    [InlineData("estafeta", "1234567890123456789012345678901", "tracking")]
    [InlineData("estafeta", null, "tracking")]
    public void Parcel_needs_carrier_and_a_valid_guide(string? carrier, string? tracking, string? field)
    {
        var errors = OrderStateMachine.ValidateShipment(DeliveryMethod.Paqueteria, carrier, tracking, "ignorado");

        if (field is null)
        {
            Assert.Empty(errors);
        }
        else
        {
            Assert.Equal(field, Assert.Single(errors).Key);
        }
    }

    [Theory]
    [InlineData("Kevin Armenta", true)]
    [InlineData("  ", false)]
    [InlineData(null, false)]
    public void Local_needs_a_courier_and_ignores_the_guide(string? courier, bool valid) =>
        Assert.Equal(valid, OrderStateMachine.ValidateShipment(DeliveryMethod.Local, null, "mala", courier).Count == 0);
}
