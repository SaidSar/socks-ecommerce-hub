using System.Net;
using System.Text.Json;
using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Tests;

public class AdminOrdersApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Url = "/api/admin/orders";

    private static IEnumerable<string?> Folios(JsonElement list) => list.GetProperty("orders").EnumerateArray().Select(o => o.GetProperty("id").GetString());

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.OK)]
    [InlineData(Owner, HttpStatusCode.OK)]
    public async Task Orders_are_for_staff(string? role, HttpStatusCode expected)
    {
        Assert.Equal(expected, (await Get(Url, role)).StatusCode);
        Assert.Equal(expected, (await Get($"{Url}/summary", role)).StatusCode);
    }

    [Fact]
    public async Task Owner_gets_amounts_and_operations_never_receives_them()
    {
        var product = await CreateProduct(5, price: 100m);
        var folio = await Buy(product.Sku, 2);

        var owner = await OrderOf(folio);
        Assert.Equal(200m, owner.GetProperty("subtotal").GetDecimal());
        Assert.Equal(99m, owner.GetProperty("shipping").GetDecimal());
        Assert.Equal(299m, owner.GetProperty("total").GetDecimal());
        Assert.Equal(100m, owner.GetProperty("items")[0].GetProperty("price").GetDecimal());

        foreach (var url in new[] { $"{Url}/{folio}", Url, $"{Url}/{folio}/packing-list", $"{Url}/summary" })
        {
            var response = await Get(url, Operations);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            AssertNoMoney(await Json(response));
        }
    }

    [Theory]
    [InlineData(typeof(OperationsOrderDto))]
    [InlineData(typeof(AdminOrderListDto<OperationsOrderDto>))]
    [InlineData(typeof(PackingListDto))]
    public void Operations_order_types_have_no_decimal(Type type) => Assert.Empty(DecimalProperties(type, []));

    internal static IEnumerable<string> DecimalProperties(Type type, HashSet<Type> seen)
    {
        if (type.IsGenericType && type.Namespace?.StartsWith("System") == true)
        {
            return type.GetGenericArguments().SelectMany(a => DecimalProperties(a, seen));
        }
        if (type.Namespace?.StartsWith("Sokko.Api.DTOs") != true || !seen.Add(type))
        {
            return [];
        }
        var properties = type.GetProperties().Where(p => p.Name != "EqualityContract").ToList();
        return properties.Where(p => (Nullable.GetUnderlyingType(p.PropertyType) ?? p.PropertyType) == typeof(decimal)).Select(p => $"{type.Name}.{p.Name}")
            .Concat(properties.SelectMany(p => DecimalProperties(p.PropertyType, seen)));
    }

    [Fact]
    public async Task Order_has_the_shape_the_panel_expects()
    {
        var product = await CreateProduct(5);
        var order = await OrderOf(await Buy(product.Sku, postalCode: LocalPostalCode));

        Assert.Equal("por_preparar", order.GetProperty("status").GetString());
        Assert.Equal("local", order.GetProperty("delivery").GetString());
        Assert.Equal("tarjeta", order.GetProperty("pay").GetString());
        Assert.Equal("pagado", order.GetProperty("paymentStatus").GetString());
        Assert.Equal("Ana López", order.GetProperty("customer").GetProperty("name").GetString());
        Assert.Equal("Los Mochis, Sinaloa", order.GetProperty("customer").GetProperty("city").GetString());
        var item = order.GetProperty("items")[0];
        Assert.Equal(product.Sku, item.GetProperty("sku").GetString());
        Assert.Equal("negro", item.GetProperty("tone").GetString());
        Assert.Equal("unidad", item.GetProperty("unit").GetString());
        Assert.Equal("pagado", order.GetProperty("history")[0].GetProperty("status").GetString());
        Assert.Equal("Tienda en línea", order.GetProperty("history")[0].GetProperty("by").GetString());
    }

    [Theory]
    [InlineData("LOPEZ")]
    [InlineData("ana lópez")]
    [InlineData("ANA.LOPEZ-BUSCADA@")]
    public async Task Search_ignores_case_and_accents(string term)
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, email: "ana.lopez-buscada@correo.test");

        Assert.Contains(folio, Folios(await Json(await Get($"{Url}?q={Uri.EscapeDataString(term)}", Owner))));
    }

    [Fact]
    public async Task Search_finds_by_folio_and_sku_and_treats_wildcards_as_text()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku);

        Assert.Equal([folio], Folios(await Json(await Get($"{Url}?q={folio.ToLowerInvariant()}", Operations))));
        Assert.Contains(folio, Folios(await Json(await Get($"{Url}?q={product.Sku}", Operations))));
        Assert.Empty(Folios(await Json(await Get($"{Url}?q={Uri.EscapeDataString("%")}", Operations))));
    }

    [Fact]
    public async Task Filters_follow_the_tabs_and_r17()
    {
        var product = await CreateProduct(9);
        var fresh = await Buy(product.Sku);
        var old = await Buy(product.Sku);
        var limit = await Buy(product.Sku);
        var oxxo = await Buy(product.Sku, payment: "oxxo_pay");
        await SetCreatedAt(old, DateTime.UtcNow.AddHours(-49));
        await SetCreatedAt(limit, DateTime.UtcNow.AddHours(-47));

        var late = await Json(await Get($"{Url}?status=late", Owner));
        Assert.Contains(old, Folios(late));
        Assert.DoesNotContain(fresh, Folios(late));
        Assert.DoesNotContain(limit, Folios(late));
        Assert.True(late.GetProperty("counts").GetProperty("late").GetInt32() >= 1);

        var pending = Folios(await Json(await Get($"{Url}?status=oxxo", Owner))).ToList();
        Assert.Contains(oxxo, pending);
        Assert.DoesNotContain(fresh, pending);

        Assert.Contains(fresh, Folios(await Json(await Get($"{Url}?status=por_preparar", Owner))));
        Assert.Empty(Folios(await Json(await Get($"{Url}?status=entregado&q={fresh}", Owner))));
        Assert.Equal(HttpStatusCode.BadRequest, (await Get($"{Url}?status=otro", Owner)).StatusCode);

        var summary = await Json(await Get($"{Url}/summary", Operations));
        Assert.True(summary.GetProperty("late").GetInt32() >= 1);
        Assert.True(summary.GetProperty("toPrepare").GetInt32() >= 4);
    }

    [Fact]
    public async Task Missing_order_gets_404()
    {
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/SKK-999999", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/SKK-999999/packing-list", Owner)).StatusCode);
    }

    [Fact]
    public async Task Note_is_saved_and_a_stale_one_gets_409()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku);
        var order = await OrderOf(folio, Operations);

        var saved = await Put($"{Url}/{folio}/note", Operations, new { note = "  Regalo  ", rowVersion = VersionOf(order) });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        Assert.Equal("Regalo", (await Json(saved)).GetProperty("note").GetString());

        var stale = await Put($"{Url}/{folio}/note", Owner, new { note = "Otra", rowVersion = VersionOf(order) });
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Equal("Regalo", (await OrderOf(folio)).GetProperty("note").GetString());
    }

    [Fact]
    public async Task Packing_list_has_the_address_and_the_units()
    {
        var product = await CreateProduct(5);
        var list = await Json(await Get($"{Url}/{await Buy(product.Sku, 3)}/packing-list", Operations));

        Assert.Equal("Calle 1", list.GetProperty("street").GetString());
        Assert.Equal(3, list.GetProperty("units").GetInt32());
        Assert.Equal(product.Sku, list.GetProperty("items")[0].GetProperty("sku").GetString());
    }

    [Fact]
    public async Task Couriers_are_the_staff_for_both_roles()
    {
        var couriers = (await Json(await Get($"{Url}/couriers", Operations))).EnumerateArray().Select(c => c.GetString()).ToList();
        Assert.Contains("Kevin Armenta", couriers);
        Assert.DoesNotContain("Nexus Code", couriers);
    }

    [Fact]
    public async Task Only_the_owner_marks_an_oxxo_as_paid()
    {
        var product = await CreateProduct(5);
        var folio = await Buy(product.Sku, payment: "oxxo_pay");
        var order = await OrderOf(folio);
        Assert.Equal("pendiente", order.GetProperty("paymentStatus").GetString());

        Assert.Equal(HttpStatusCode.Forbidden, (await Post($"{Url}/{folio}/payment", Operations, new { rowVersion = VersionOf(order) })).StatusCode);

        var paid = await Post($"{Url}/{folio}/payment", Owner, new { rowVersion = VersionOf(order) });
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);
        var dto = await Json(paid);
        Assert.Equal("pagado", dto.GetProperty("paymentStatus").GetString());
        var last = dto.GetProperty("history").EnumerateArray().Last();
        Assert.Equal("pagado", last.GetProperty("status").GetString());
        Assert.Equal("Aiko M.", last.GetProperty("by").GetString());

        var again = await Post($"{Url}/{folio}/payment", Owner, new { rowVersion = VersionOf(dto) });
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("ya está pagado", (await Json(again)).GetProperty("title").GetString());
    }

    [Theory]
    [InlineData(CarrierCodes.Estafeta, Carrier.Estafeta)]
    [InlineData(CarrierCodes.DhlExpress, Carrier.DHLExpress)]
    public void Carrier_codes_map_both_ways(string code, Carrier carrier)
    {
        Assert.Equal(carrier, CarrierCodes.Parse(code));
        Assert.Equal(code, CarrierCodes.ToCode(carrier));
    }

    [Fact]
    public void Every_carrier_has_a_code() =>
        Assert.All(Enum.GetValues<Carrier>(), c => Assert.Equal(c, CarrierCodes.Parse(CarrierCodes.ToCode(c))));
}

public class OrderEmailApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    [Fact]
    public async Task Card_and_oxxo_purchases_send_their_confirmation()
    {
        var product = await CreateProduct(5);

        var card = await Buy(product.Sku);
        var oxxo = await Buy(product.Sku, payment: "oxxo_pay");

        var mails = Factory.Email.Orders;
        var cardMail = mails.Single(m => m.Folio == card);
        Assert.Equal("ana.lopez@correo.test", cardMail.Email);
        Assert.Null(cardMail.OxxoReference);
        Assert.Equal("Producto de prueba", cardMail.Lines.Single().Name);

        var oxxoMail = mails.Single(m => m.Folio == oxxo);
        Assert.StartsWith("93", oxxoMail.OxxoReference);
        Assert.NotNull(oxxoMail.OxxoExpiresAt);
    }
}
