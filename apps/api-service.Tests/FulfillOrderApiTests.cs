using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Tests;

public class FulfillOrderApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Guide = "123456789012";

    private Task<HttpResponseMessage> Advance(string folio, string role, string status, JsonElement order, string? carrier = null, string? tracking = null, string? courier = null) =>
        Post($"/api/admin/orders/{folio}/transitions", role, new { status, carrier, tracking, courier, rowVersion = VersionOf(order) });

    private Task<HttpResponseMessage> Cancel(string folio, string role, JsonElement order) =>
        Post($"/api/admin/orders/{folio}/cancel", role, new { rowVersion = VersionOf(order) });

    private async Task<JsonElement> Step(string folio, string status, string? carrier = null, string? tracking = null, string? courier = null, string role = Operations)
    {
        var response = await Advance(folio, role, status, await OrderOf(folio), carrier, tracking, courier);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await Json(response);
    }

    private static string[] HistoryOf(JsonElement order) => order.GetProperty("history").EnumerateArray().Select(h => h.GetProperty("status").GetString()!).ToArray();

    [Fact]
    public async Task Customers_and_anonymous_cannot_touch_orders()
    {
        var product = await CreateProduct(2);
        var folio = await Buy(product.Sku);
        var order = await OrderOf(folio);

        Assert.Equal(HttpStatusCode.Unauthorized, (await Advance(folio, null!, "preparando", order)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Advance(folio, Customer, "preparando", order)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Cancel(folio, Customer, order)).StatusCode);
    }

    [Fact]
    public async Task Parcel_order_goes_from_checkout_to_delivered_with_the_kardex_and_reserved_matching()
    {
        var product = await CreateProduct(10);
        var folio = await Buy(product.Sku, 3);
        Assert.Equal((10, 3, 10, InventoryMovementType.InventarioInicial), await InventoryOf(product));

        // Preparar no mueve existencias.
        await Step(folio, "preparando");
        Assert.Equal((10, 3, 10, InventoryMovementType.InventarioInicial), await InventoryOf(product));

        // Enviar descuenta stock y apartado y escribe la Venta con el saldo (R-09, R-19).
        var sent = await Step(folio, "enviado", "dhl_express", Guide);
        Assert.Equal("enviado", sent.GetProperty("status").GetString());
        Assert.Equal("dhl_express", sent.GetProperty("carrier").GetString());
        Assert.Equal(Guide, sent.GetProperty("tracking").GetString());
        Assert.Equal((7, 0, 7, InventoryMovementType.Venta), await InventoryOf(product));

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var sale = await db.InventoryMovements.Include(m => m.Order).SingleAsync(m => m.VariantId == product.VariantId && m.Type == InventoryMovementType.Venta, Ct);
            Assert.Equal(-3, sale.Quantity);
            Assert.Equal($"Pedido {folio}", sale.Note);
            Assert.Equal(folio, sale.Order!.Folio);
            Assert.Equal("Daniel R.", sale.CreatedByName);
            var shipment = await db.Shipments.AsNoTracking().SingleAsync(s => s.Order.Folio == folio, Ct);
            Assert.Equal(DeliveryMethod.Paqueteria, shipment.DeliveryMethod);
            Assert.Null(shipment.DeliveredAt);
        }

        var delivered = await Step(folio, "entregado");
        Assert.Equal("entregado", delivered.GetProperty("status").GetString());
        Assert.Equal(["pagado", "preparando", "enviado", "entregado"], HistoryOf(delivered));
        Assert.Equal((7, 0, 7, InventoryMovementType.Venta), await InventoryOf(product));

        using var last = Factory.Services.CreateScope();
        Assert.NotNull(await last.ServiceProvider.GetRequiredService<SokkoDbContext>().Shipments.Where(s => s.Order.Folio == folio).Select(s => s.DeliveredAt).SingleAsync(Ct));
    }

    [Fact]
    public async Task Local_order_goes_out_with_a_courier_and_the_staff_one_is_linked()
    {
        var product = await CreateProduct(4);
        var folio = await Buy(product.Sku, postalCode: LocalPostalCode);

        await Step(folio, "preparando");
        var sent = await Step(folio, "en_ruta", courier: "Kevin Armenta");
        Assert.Equal("Kevin Armenta", sent.GetProperty("courier").GetString());
        Assert.Equal("", sent.GetProperty("tracking").GetString());
        Assert.Equal((3, 0, 3, InventoryMovementType.Venta), await InventoryOf(product));

        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var shipment = await db.Shipments.AsNoTracking().SingleAsync(s => s.Order.Folio == folio, Ct);
            var kevin = await db.Users.SingleAsync(u => u.Email == "kevin@sokko.mx", Ct);
            Assert.Equal(kevin.Id, shipment.CourierUserId);
        }

        Assert.Equal("entregado", (await Step(folio, "entregado")).GetProperty("status").GetString());
    }

    [Fact]
    public async Task External_courier_is_kept_as_a_name_only()
    {
        var product = await CreateProduct(1);
        var folio = await Buy(product.Sku, postalCode: LocalPostalCode);
        await Step(folio, "preparando");

        await Step(folio, "en_ruta", courier: "Mensajería Ahome");

        using var scope = Factory.Services.CreateScope();
        var shipment = await scope.ServiceProvider.GetRequiredService<SokkoDbContext>().Shipments.AsNoTracking().SingleAsync(s => s.Order.Folio == folio, Ct);
        Assert.Null(shipment.CourierUserId);
        Assert.Equal("Mensajería Ahome", shipment.CourierName);
    }

    [Fact]
    public async Task Shipping_needs_the_guide_or_the_courier()
    {
        var product = await CreateProduct(6);
        var parcel = await Buy(product.Sku);
        var local = await Buy(product.Sku, postalCode: LocalPostalCode);
        await Step(parcel, "preparando");
        await Step(local, "preparando");

        var bad = await Advance(parcel, Operations, "enviado", await OrderOf(parcel), "estafeta", "123");
        Assert.Equal(HttpStatusCode.BadRequest, bad.StatusCode);
        Assert.Equal("Escriba el número de guía (solo dígitos, mínimo 10).", (await Json(bad)).GetProperty("errors").GetProperty("tracking")[0].GetString());

        var noCourier = await Advance(local, Operations, "en_ruta", await OrderOf(local));
        Assert.Equal(HttpStatusCode.BadRequest, noCourier.StatusCode);
        Assert.Equal("Elija quién lleva el pedido.", (await Json(noCourier)).GetProperty("errors").GetProperty("courier")[0].GetString());

        // Nada se movió: sigue todo apartado.
        Assert.Equal((6, 2, 6, InventoryMovementType.InventarioInicial), await InventoryOf(product));
    }

    [Fact]
    public async Task A_step_out_of_order_or_for_another_delivery_method_is_refused()
    {
        var product = await CreateProduct(3);
        var folio = await Buy(product.Sku);
        var order = await OrderOf(folio);

        Assert.Equal(HttpStatusCode.Conflict, (await Advance(folio, Operations, "enviado", order, "estafeta", Guide)).StatusCode);
        await Step(folio, "preparando");
        // Paquetería no sale a ruta (CK_Orders_StatusMatchesDelivery).
        Assert.Equal(HttpStatusCode.Conflict, (await Advance(folio, Operations, "en_ruta", await OrderOf(folio), courier: "Kevin Armenta")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post($"/api/admin/orders/{folio}/transitions", Operations, new { status = "otro", rowVersion = VersionOf(order) })).StatusCode);
        Assert.Equal((3, 1, 3, InventoryMovementType.InventarioInicial), await InventoryOf(product));
    }

    [Fact]
    public async Task Unpaid_oxxo_cannot_be_prepared_until_it_is_marked_as_paid()
    {
        var product = await CreateProduct(3);
        var folio = await Buy(product.Sku, payment: "oxxo_pay");
        var order = await OrderOf(folio);

        var refused = await Advance(folio, Operations, "preparando", order);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Contains("pendiente", (await Json(refused)).GetProperty("title").GetString());

        Assert.Equal(HttpStatusCode.OK, (await Post($"/api/admin/orders/{folio}/payment", Owner, new { rowVersion = VersionOf(order) })).StatusCode);
        Assert.Equal(["por_preparar", "pagado", "preparando"], HistoryOf(await Step(folio, "preparando")));
    }

    [Fact]
    public async Task Cancelling_releases_what_was_reserved_and_refunds_a_paid_order()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, 2);
        await Step(folio, "preparando");
        Assert.Equal(2, (await InventoryOf(product)).Reserved);

        var response = await Cancel(folio, Operations, await OrderOf(folio));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await Json(response);
        Assert.Equal("cancelado", dto.GetProperty("status").GetString());
        Assert.Equal("reembolsado", dto.GetProperty("paymentStatus").GetString());
        Assert.Equal("Daniel R.", dto.GetProperty("history").EnumerateArray().Last().GetProperty("by").GetString());
        // Liberar no escribe en el kárdex: el stock no cambió (R-10).
        Assert.Equal((5, 0, 5, InventoryMovementType.InventarioInicial), await InventoryOf(product));
    }

    [Fact]
    public async Task Cancelling_an_unpaid_oxxo_keeps_it_pending()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, payment: "oxxo_pay");

        var dto = await Json(await Cancel(folio, Owner, await OrderOf(folio)));

        Assert.Equal("cancelado", dto.GetProperty("status").GetString());
        Assert.Equal("pendiente", dto.GetProperty("paymentStatus").GetString());
        Assert.Equal(0, (await InventoryOf(product)).Reserved);
    }

    [Fact]
    public async Task An_order_that_left_the_warehouse_cannot_be_cancelled()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku);
        await Step(folio, "preparando");
        await Step(folio, "enviado", "estafeta", Guide);

        var refused = await Cancel(folio, Owner, await OrderOf(folio));

        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Equal((4, 0, 4, InventoryMovementType.Venta), await InventoryOf(product));
    }

    [Fact]
    public async Task Two_operators_on_the_same_order_the_second_gets_409_and_stock_moves_once()
    {
        var product = await CreateProduct(8);
        var folio = await Buy(product.Sku, 2);
        await Step(folio, "preparando");
        var seenByBoth = await OrderOf(folio, Operations);

        Assert.Equal(HttpStatusCode.OK, (await Advance(folio, Operations, "enviado", seenByBoth, "estafeta", Guide)).StatusCode);
        var second = await Advance(folio, Owner, "enviado", seenByBoth, "dhl_express", "999999999999");

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        Assert.Contains("Otra persona", (await Json(second)).GetProperty("title").GetString());
        Assert.Equal((6, 0, 6, InventoryMovementType.Venta), await InventoryOf(product));
        Assert.Equal("estafeta", (await OrderOf(folio)).GetProperty("carrier").GetString());

        var cancel = await Cancel(folio, Owner, seenByBoth);
        Assert.Equal(HttpStatusCode.Conflict, cancel.StatusCode);
    }

    [Fact]
    public async Task Simultaneous_requests_never_ship_twice()
    {
        var product = await CreateProduct(8);
        var folio = await Buy(product.Sku, 2);
        await Step(folio, "preparando");
        var seen = await OrderOf(folio);

        var responses = await Task.WhenAll(
            Advance(folio, Operations, "enviado", seen, "estafeta", Guide),
            Advance(folio, Owner, "enviado", seen, "estafeta", Guide));

        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal((6, 0, 6, InventoryMovementType.Venta), await InventoryOf(product));
    }

    [Fact]
    public async Task Edit_without_row_version_is_rejected()
    {
        var product = await CreateProduct(2);
        var folio = await Buy(product.Sku);

        Assert.Equal(HttpStatusCode.BadRequest, (await Post($"/api/admin/orders/{folio}/transitions", Operations, new { status = "preparando" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Post($"/api/admin/orders/{folio}/cancel", Operations, new { })).StatusCode);
    }

    [Fact]
    public async Task Missing_order_gets_404()
    {
        var product = await CreateProduct(1);
        var order = await OrderOf(await Buy(product.Sku));

        Assert.Equal(HttpStatusCode.NotFound, (await Advance("SKK-999999", Operations, "preparando", order)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Cancel("SKK-999999", Operations, order)).StatusCode);
    }
}
