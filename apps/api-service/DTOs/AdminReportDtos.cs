using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>KPIs del periodo contra el periodo anterior de igual duración. Solo el Dueño (finance.view).</summary>
public record SalesReportKpisDto(
    DashboardMoneyDto Sales,
    DashboardCountDto Orders,
    DashboardMoneyDto Ticket,
    DashboardMoneyDto TaxIncluded,
    DashboardMoneyDto Shipping,
    DashboardCountDto Cancelled,
    DashboardCountDto Units,
    /// <summary>Descuentos de cupón de las ventas. Las ventas ya son el total cobrado, neto de descuento.</summary>
    DashboardMoneyDto Discounts);

/// <summary>Un día local: <c>Date</c> es su mediodía en UTC. <c>Prev</c> es el día equivalente del periodo anterior.</summary>
public record SalesReportDayDto(DateTime Date, decimal V, int Orders, decimal Prev, int PrevOrders);

public record SalesReportLineDto(ProductLine Line, int Units, decimal Revenue);

public record SalesReportProductDto(int ProductId, string Name, ProductLine Line, int Units, decimal Revenue);

public record SalesReportPaymentDto(PaymentMethod Method, int Orders, decimal Sales);

public record SalesReportDeliveryDto(DeliveryMethod Method, int Orders, decimal Sales, decimal Shipping);

public record SalesReportDto(
    DateOnly From,
    DateOnly To,
    DateOnly PrevFrom,
    DateOnly PrevTo,
    SalesReportKpisDto Kpis,
    IReadOnlyList<SalesReportDayDto> Daily,
    IReadOnlyList<SalesReportLineDto> Lines,
    IReadOnlyList<SalesReportProductDto> Top,
    IReadOnlyList<SalesReportPaymentDto> Payments,
    IReadOnlyList<SalesReportDeliveryDto> Deliveries);
