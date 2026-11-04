using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using Sokko.Api.Data.Seed;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Tests;

/// <summary>El envío en el pedido del cliente: paquetería con guía o repartidor local, nunca el Id del repartidor.</summary>
public class OrderShipmentTests(OrdersApiFactory factory) : IClassFixture<OrdersApiFactory>
{
    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web)
    {
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower, allowIntegerValues: false) },
    };

    private readonly HttpClient _client = factory.CreateClient();

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static Order NewOrder(Shipment? shipment) => new()
    {
        CustomerFirstName = "Ana", CustomerLastName = "López", CustomerEmail = "ana@correo.test", CustomerPhone = "6681234567",
        ShipStreet = "Calle 1", ShipNeighborhood = "Centro", ShipCity = "Los Mochis", ShipState = "Sinaloa", ShipPostalCode = "81200",
        DeliveryMethod = shipment?.DeliveryMethod ?? DeliveryMethod.Paqueteria, PaymentMethod = PaymentMethod.Tarjeta, Shipment = shipment,
    };

    [Fact]
    public void Order_without_shipment_has_a_null_shipment()
    {
        var json = JsonSerializer.SerializeToElement(OrderDto.From(NewOrder(null), TimeSpan.FromHours(72)), Web);

        Assert.Equal(JsonValueKind.Null, json.GetProperty("shipment").ValueKind);
    }

    [Fact]
    public void Parcel_shipment_uses_the_api_carrier_code()
    {
        var shipped = new DateTime(2026, 11, 1, 18, 0, 0, DateTimeKind.Utc);
        var shipment = new Shipment { DeliveryMethod = DeliveryMethod.Paqueteria, Carrier = Carrier.DHLExpress, TrackingNumber = "1234567890", ShippedAt = shipped };

        var json = JsonSerializer.SerializeToElement(OrderDto.From(NewOrder(shipment), TimeSpan.FromHours(72)), Web).GetProperty("shipment");

        Assert.Equal("dhl_express", json.GetProperty("carrier").GetString());
        Assert.Equal("1234567890", json.GetProperty("trackingNumber").GetString());
        Assert.Equal(shipped, json.GetProperty("shippedAt").GetDateTime());
        Assert.Equal(JsonValueKind.Null, json.GetProperty("courierName").ValueKind);
    }

    [Fact]
    public void Local_shipment_shows_the_courier_name_but_never_its_user_id()
    {
        var shipment = new Shipment
        {
            DeliveryMethod = DeliveryMethod.Local, CourierUserId = 2, CourierName = "Daniel Ruiz", ShippedAt = DateTime.UtcNow,
            CourierUser = new User { Id = 2, FirstName = "Daniel", LastName = "Ruiz", Email = "repartidor@sokko.test" },
        };

        var json = JsonSerializer.Serialize(OrderDto.From(NewOrder(shipment), TimeSpan.FromHours(72)), Web);

        Assert.Contains("\"courierName\":\"Daniel Ruiz\"", json);
        Assert.DoesNotContain("courierUser", json, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("repartidor@sokko.test", json);
    }

    private async Task<string> GuestRead(DemoOrdersSeed.DemoOrder order)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, $"/api/orders/SKK-{order.Folio}");
        request.Headers.Add("X-Customer-Email", order.Email);
        var response = await _client.SendAsync(request, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await response.Content.ReadAsStringAsync(Ct);
    }

    [Fact]
    public async Task Guest_tracking_returns_the_carrier_and_tracking_number()
    {
        var demo = DemoOrdersSeed.Orders.First(o => o.Carrier == Carrier.Estafeta);

        var shipment = JsonDocument.Parse(await GuestRead(demo)).RootElement.GetProperty("shipment");

        Assert.Equal("estafeta", shipment.GetProperty("carrier").GetString());
        Assert.Equal(demo.Tracking, shipment.GetProperty("trackingNumber").GetString());
    }

    [Fact]
    public async Task Guest_tracking_of_a_local_delivery_hides_the_internal_courier()
    {
        // En la semilla, "Daniel Ruiz" es el usuario de Operaciones: el envío guarda su CourierUserId.
        var demo = DemoOrdersSeed.Orders.First(o => o.Delivery == DeliveryMethod.Local && o.Courier == "Daniel Ruiz");

        var body = await GuestRead(demo);

        var shipment = JsonDocument.Parse(body).RootElement.GetProperty("shipment");
        Assert.Equal("Daniel Ruiz", shipment.GetProperty("courierName").GetString());
        Assert.Equal(JsonValueKind.Null, shipment.GetProperty("carrier").ValueKind);
        Assert.DoesNotContain("courierUser", body, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Guest_tracking_before_shipping_has_no_shipment()
    {
        var demo = DemoOrdersSeed.Orders.First(o => o.Status == OrderStatus.PorPreparar && o.Payment == PaymentMethod.Tarjeta);

        var json = JsonDocument.Parse(await GuestRead(demo)).RootElement;

        Assert.Equal(JsonValueKind.Null, json.GetProperty("shipment").ValueKind);
    }
}
