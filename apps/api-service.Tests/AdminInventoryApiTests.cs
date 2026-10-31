using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class AdminInventoryApiTests(AdminApiFactory factory) : AdminOpsTestBase(factory)
{
    private const string Url = "/api/admin/inventory";
    private const string Header = "SKU,Pieza,Tono,Talla,Stock";

    private async Task<JsonElement> RowOf(TestProduct p) => await Json(await Get($"{Url}/{p.Sku}", Owner));

    private async Task<HttpResponseMessage> Move(TestProduct p, string type, int? qty, string? note = null, string? folio = null, string role = Operations, string? rowVersion = null) =>
        await Post($"{Url}/{p.Sku}/movements", role, new { type, qty, note, folio, rowVersion = rowVersion ?? VersionOf(await RowOf(p)) });

    private static async Task<string> FieldError(HttpResponseMessage response, string field)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        return (await Json(response)).GetProperty("errors").GetProperty(field)[0].GetString()!;
    }

    private Task<HttpResponseMessage> Preview(string csv, string role = Owner) => Post($"{Url}/import/preview", role, new { csv });

    private Task<HttpResponseMessage> Import(string csv, string role = Owner) => Post($"{Url}/import", role, new { csv });

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized)]
    [InlineData(Customer, HttpStatusCode.Forbidden)]
    [InlineData(Operations, HttpStatusCode.OK)]
    public async Task Inventory_is_for_staff(string? role, HttpStatusCode expected) =>
        Assert.Equal(expected, (await Get(Url, role)).StatusCode);

    [Fact]
    public async Task List_has_the_shape_of_the_panel_and_no_money()
    {
        var list = await Json(await Get($"{Url}?q=SKK-007-SUM-M", Operations));
        var row = list.GetProperty("rows")[0];

        Assert.Equal("Tabi Origami Noche", row.GetProperty("piece").GetString());
        Assert.Equal("sumi", row.GetProperty("tone").GetString());
        Assert.Equal("Tinta Sumi", row.GetProperty("toneName").GetString());
        Assert.Equal(120, row.GetProperty("edition").GetInt32());
        Assert.Equal("par", row.GetProperty("unit").GetString());
        Assert.Equal(row.GetProperty("stock").GetInt32() - row.GetProperty("reserved").GetInt32(), row.GetProperty("available").GetInt32());
        Assert.True(list.GetProperty("count").GetInt32() >= 120);
        Assert.True(list.GetProperty("counts").GetProperty("todos").GetInt32() >= 120);
        Assert.Equal(4, list.GetProperty("few").GetInt32());
        AssertNoMoney(list);
    }

    [Fact]
    public async Task Search_ignores_accents_and_filters_follow_the_state()
    {
        Assert.NotEqual(0, (await Json(await Get($"{Url}?q=TSUCHI%20RAIZ", Owner))).GetProperty("rows").GetArrayLength());

        var empty = await CreateProduct(0);
        var few = await CreateProduct(3);
        var plenty = await CreateProduct(50);
        var skus = async (string state) => (await Json(await Get($"{Url}?state={state}", Owner))).GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("sku").GetString()).ToList();

        Assert.Contains(empty.Sku, await skus("agotado"));
        Assert.Contains(few.Sku, await skus("pocos"));
        Assert.Contains(plenty.Sku, await skus("ok"));
        var alerts = await skus("alertas");
        Assert.Contains(empty.Sku, alerts);
        Assert.Contains(few.Sku, alerts);
        Assert.DoesNotContain(plenty.Sku, alerts);
        Assert.Equal(HttpStatusCode.BadRequest, (await Get($"{Url}?state=otro", Owner)).StatusCode);
    }

    [Fact]
    public async Task Each_manual_movement_moves_stock_and_writes_the_kardex()
    {
        var p = await CreateProduct(10);

        var entrada = await Json(await Move(p, "entrada", 5));
        Assert.Equal(15, entrada.GetProperty("row").GetProperty("stock").GetInt32());
        Assert.Equal(5, entrada.GetProperty("movement").GetProperty("qty").GetInt32());
        Assert.Equal(15, entrada.GetProperty("movement").GetProperty("balance").GetInt32());
        Assert.Equal("Daniel R.", entrada.GetProperty("movement").GetProperty("user").GetString());

        var merma = await Json(await Move(p, "merma", 3, "Hilo jalado"));
        Assert.Equal(-3, merma.GetProperty("movement").GetProperty("qty").GetInt32());
        Assert.Equal(12, merma.GetProperty("row").GetProperty("stock").GetInt32());

        var conteo = await Json(await Move(p, "conteo_fisico", 8));
        Assert.Equal(-4, conteo.GetProperty("movement").GetProperty("qty").GetInt32());
        Assert.Equal("Ajuste tras conteo", conteo.GetProperty("movement").GetProperty("note").GetString());
        Assert.Equal((8, 0, 8, InventoryMovementType.ConteoFisico), await InventoryOf(p));

        var kardex = await Json(await Get($"{Url}/{p.Sku}/movements", Operations));
        Assert.Equal(["conteo_fisico", "merma", "entrada", "inventario_inicial"], kardex.EnumerateArray().Select(m => m.GetProperty("type").GetString()));
        AssertNoMoney(kardex);
    }

    [Fact]
    public async Task Merma_above_what_is_available_gets_400_r27()
    {
        var p = await CreateProduct(5);
        await Buy(p.Sku, 2);

        var message = await FieldError(await Move(p, "merma", 4, "Mancha"), "qty");

        Assert.Equal("No puede sacar más de 3 unidades; 2 están apartadas para pedidos.", message);
        Assert.Equal((5, 2, 5, InventoryMovementType.InventarioInicial), await InventoryOf(p));
        Assert.Equal(HttpStatusCode.OK, (await Move(p, "merma", 3, "Mancha")).StatusCode);
        Assert.Equal((2, 2, 2, InventoryMovementType.Merma), await InventoryOf(p));
    }

    [Fact]
    public async Task Merma_without_reserved_says_only_the_limit()
    {
        var p = await CreateProduct(2);
        Assert.Equal("No puede sacar más de 2 unidades.", await FieldError(await Move(p, "merma", 3, "Mancha"), "qty"));
    }

    [Fact]
    public async Task Physical_count_cannot_go_below_reserved_r27()
    {
        var p = await CreateProduct(5);
        await Buy(p.Sku, 2);

        Assert.Contains("menor que las 2 unidades apartadas", await FieldError(await Move(p, "conteo_fisico", 1), "qty"));
        Assert.Equal(HttpStatusCode.OK, (await Move(p, "conteo_fisico", 2)).StatusCode);
    }

    [Theory]
    [InlineData("entrada", 0, "qty")]
    [InlineData("entrada", -1, "qty")]
    [InlineData("conteo_fisico", -1, "qty")]
    [InlineData("merma", 1, "note")]
    [InlineData("devolucion", 1, "note")]
    [InlineData("venta", 1, "type")]
    [InlineData("inventario_inicial", 1, "type")]
    public async Task Invalid_movements_get_400(string type, int qty, string field)
    {
        var p = await CreateProduct(5);
        Assert.NotEmpty(await FieldError(await Move(p, type, qty), field));
    }

    [Fact]
    public async Task Return_needs_a_shipped_order_that_carries_the_sku()
    {
        var p = await CreateProduct(5);
        var other = await CreateProduct(5);
        var folio = await Buy(p.Sku);
        var notes = "Cambio de talla";

        Assert.Contains("folio del pedido", await FieldError(await Move(p, "devolucion", 1, notes), "folio"));
        Assert.Contains("No encontramos", await FieldError(await Move(p, "devolucion", 1, notes, "SKK-999999"), "folio"));
        Assert.Contains("no lleva este SKU", await FieldError(await Move(other, "devolucion", 1, notes, folio), "folio"));
        Assert.Contains("no sale de bodega", await FieldError(await Move(p, "devolucion", 1, notes, folio), "folio"));

        var order = await OrderOf(folio);
        order = await Json(await Post($"/api/admin/orders/{folio}/transitions", Owner, new { status = "preparando", rowVersion = VersionOf(order) }));
        await Post($"/api/admin/orders/{folio}/transitions", Owner, new { status = "enviado", carrier = "estafeta", tracking = "1234567890", rowVersion = VersionOf(order) });

        var done = await Json(await Move(p, "devolucion", 1, notes, folio.ToLowerInvariant()));
        Assert.Equal(folio, done.GetProperty("movement").GetProperty("order").GetString());
        Assert.Equal(5, done.GetProperty("row").GetProperty("stock").GetInt32());
    }

    [Fact]
    public async Task Stale_adjustment_or_one_after_a_sale_gets_409()
    {
        var p = await CreateProduct(5);
        var seen = VersionOf(await RowOf(p));

        Assert.Equal(HttpStatusCode.OK, (await Move(p, "entrada", 1, rowVersion: seen)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(p, "entrada", 1, role: Owner, rowVersion: seen)).StatusCode);

        // Un apartado de la tienda también cambia la versión (DESIGN_DB §4.1).
        var before = VersionOf(await RowOf(p));
        await Buy(p.Sku);
        Assert.Equal(HttpStatusCode.Conflict, (await Move(p, "merma", 1, "Mancha", rowVersion: before)).StatusCode);
        Assert.Equal((6, 1, 6, InventoryMovementType.Entrada), await InventoryOf(p));
    }

    [Fact]
    public async Task Missing_sku_gets_404()
    {
        var p = await CreateProduct(1);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/SKK-999-XXX-M", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Get($"{Url}/SKK-999-XXX-M/movements", Owner)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Post($"{Url}/SKK-999-XXX-M/movements", Owner, new { type = "entrada", qty = 1, rowVersion = VersionOf(await RowOf(p)) })).StatusCode);
    }

    [Fact]
    public async Task Only_the_owner_imports()
    {
        foreach (var (role, status) in new (string?, HttpStatusCode)[] { (null, HttpStatusCode.Unauthorized), (Customer, HttpStatusCode.Forbidden), (Operations, HttpStatusCode.Forbidden) })
        {
            Assert.Equal(status, (await Preview(Header, role!)).StatusCode);
            Assert.Equal(status, (await Import(Header, role!)).StatusCode);
            Assert.Equal(status, (await Get($"{Url}/import/template", role)).StatusCode);
        }
    }

    [Fact]
    public async Task Mixed_file_applies_only_the_valid_rows_as_initial_inventory()
    {
        var a = await CreateProduct(5);
        var b = await CreateProduct(5);
        var reserved = await CreateProduct(5);
        await Buy(reserved.Sku, 3);
        var csv = string.Join('\n',
            "sku;Pieza;TONO;Talla;Stock",
            $"{a.Sku.ToLowerInvariant()};x;x;U;30",
            $"{b.Sku};x;x;U;31",
            "SKK-099-AZU-M;x;x;M;10",
            $"{a.Sku};x;x;U;9",
            $"{reserved.Sku};x;x;U;2");

        var preview = await Json(await Preview(csv));
        Assert.Equal("", preview.GetProperty("error").GetString());
        Assert.Equal(2, preview.GetProperty("valid").GetArrayLength());
        var errors = preview.GetProperty("invalid").EnumerateArray().Select(r => r.GetProperty("error").GetString()).ToList();
        Assert.Equal(["El SKU no existe en el catálogo", "SKU repetido en el archivo; se usa la primera fila", "El stock (2) es menor que las 3 unidades apartadas para pedidos"], errors);
        Assert.Equal(4, preview.GetProperty("invalid")[0].GetProperty("line").GetInt32());
        // La vista previa no escribe.
        Assert.Equal((5, 0, 5, InventoryMovementType.InventarioInicial), await InventoryOf(a));

        var result = await Json(await Import(csv));
        Assert.Equal(2, result.GetProperty("applied").GetInt32());
        Assert.Equal(3, result.GetProperty("skipped").GetInt32());
        Assert.Equal((30, 0, 30, InventoryMovementType.InventarioInicial), await InventoryOf(a));
        Assert.Equal((31, 0, 31, InventoryMovementType.InventarioInicial), await InventoryOf(b));
        Assert.Equal((5, 3, 5, InventoryMovementType.InventarioInicial), await InventoryOf(reserved));

        var last = (await Json(await Get($"{Url}/{a.Sku}/movements", Owner)))[0];
        Assert.Equal(25, last.GetProperty("qty").GetInt32());
        Assert.Equal("Importado desde CSV", last.GetProperty("note").GetString());
    }

    [Theory]
    [InlineData("-2", "El stock no puede ser negativo")]
    [InlineData("1.5", "El stock debe ser un número entero")]
    [InlineData("doce", "El stock debe ser un número entero")]
    [InlineData("", "El stock debe ser un número entero")]
    public async Task Stock_cell_is_validated(string stock, string expected)
    {
        var p = await CreateProduct(1);
        var preview = await Json(await Preview($"{Header}\n{p.Sku},x,x,U,{stock}"));
        Assert.Equal(expected, preview.GetProperty("invalid")[0].GetProperty("error").GetString());
    }

    [Theory]
    [InlineData("", "El archivo está vacío.")]
    [InlineData("SKU,Pieza,Stock\nA,B,1", "El archivo necesita las columnas SKU, Pieza, Tono, Talla y Stock, en ese orden.")]
    [InlineData("SKU,Pieza,Tono,Talla,Stock,color\nA,B,C,D,1,x", "La columna \"color\" no se reconoce. Las opcionales son: line, brand, type, collection, units_per_pack, unit_cost, barcode.")]
    public async Task File_level_errors_stop_the_preview(string csv, string expected)
    {
        var preview = await Json(await Preview(csv));
        Assert.Equal(expected, preview.GetProperty("error").GetString());
        Assert.Equal(0, preview.GetProperty("valid").GetArrayLength());
    }

    [Theory]
    [InlineData("line", "marcas", "La línea no coincide con el SKU (Accesorios): la línea forma parte del SKU y no cambia.")]
    [InlineData("line", "zapatos", "La línea \"zapatos\" no existe (sokko, marcas, especiales o accesorios).")]
    [InlineData("type", "calcetas", "El tipo no coincide con el producto (Lentes): cámbielo desde Productos.")]
    [InlineData("type", "zapatos", "El tipo \"zapatos\" no existe.")]
    [InlineData("brand", "sokko", "La marca SOKKO es exclusiva de la línea SOKKO Japón.")]
    [InlineData("brand", "patito", "La marca \"patito\" no existe; créela en Marcas.")]
    [InlineData("collection", "verano", "La colección \"verano\" no existe.")]
    [InlineData("units_per_pack", "13", "Las unidades por paquete deben ser un entero de 1 a 12.")]
    [InlineData("unit_cost", "abc", "El costo debe ser un número, por ejemplo 82.50.")]
    [InlineData("unit_cost", "-5", "El costo no puede ser negativo.")]
    [InlineData("barcode", "019523800100", "Ese código de barras ya está en MRC-001-BLA-S.")]
    [InlineData("barcode", "con-guion", "El código de barras solo admite letras y números, hasta 32.")]
    public async Task Catalog_columns_use_the_rules_of_the_product_form(string column, string value, string expected)
    {
        var p = await CreateProduct(1);
        var preview = await Json(await Preview($"{Header},{column}\n{p.Sku},x,x,U,1,{value}"));
        Assert.Equal(expected, preview.GetProperty("invalid")[0].GetProperty("error").GetString());
    }

    [Fact]
    public async Task Catalog_columns_are_applied()
    {
        var p = await CreateProduct(1);
        var barcode = $"7501{Guid.NewGuid().ToString("N")[..8]}";
        var csv = $"{Header},brand,collection,units_per_pack,unit_cost,barcode\n{p.Sku},x,x,U,4,Nike,navidad,3,95.50,{barcode}";

        var preview = await Json(await Preview(csv));
        var changes = preview.GetProperty("valid")[0].GetProperty("changes");
        Assert.Equal("nike", changes.GetProperty("brand").GetString());
        Assert.Equal(95.50m, changes.GetProperty("unitCost").GetDecimal());

        Assert.Equal(1, (await Json(await Import(csv))).GetProperty("applied").GetInt32());

        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var variant = await db.ProductVariants.Include(v => v.Product).ThenInclude(x => x.Brand).Include(v => v.Product).ThenInclude(x => x.Collection).AsNoTracking().SingleAsync(v => v.Id == p.VariantId, Ct);
        Assert.Equal(4, variant.Stock);
        Assert.Equal(95.50m, variant.UnitCost);
        Assert.Equal(barcode, variant.Barcode);
        Assert.Equal("nike", variant.Product.Brand.Slug);
        Assert.Equal("navidad", variant.Product.Collection!.Slug);
        Assert.Equal(3, variant.Product.UnitsPerPack);
    }

    [Fact]
    public async Task Cost_of_a_row_does_not_block_the_other_variants_of_its_product()
    {
        var p = await CreateProduct(1, unitCost: 10m);
        var sibling = p.Sku.Replace("NEG", "BLA");
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            db.ProductVariants.Add(new Models.ProductVariant { ProductId = p.Id, ColorCode = "BLA", SizeId = Data.Seed.CatalogSeed.SizeIds.Unitalla, Sku = sibling, UnitCost = 10m });
            await db.SaveChangesAsync(Ct);
        }

        var result = await Json(await Import($"{Header},unit_cost\n{p.Sku},x,x,U,7,20\n{sibling},x,x,U,8,20"));

        Assert.Equal(2, result.GetProperty("applied").GetInt32());
        Assert.Equal(0, result.GetProperty("skipped").GetInt32());
        using var check = Factory.Services.CreateScope();
        var variants = await check.ServiceProvider.GetRequiredService<SokkoDbContext>().ProductVariants.AsNoTracking().Where(v => v.ProductId == p.Id).OrderBy(v => v.Id).ToListAsync(Ct);
        Assert.Equal([7, 8], variants.Select(v => v.Stock));
        Assert.All(variants, v => Assert.Equal(20m, v.UnitCost));
    }

    [Fact]
    public async Task Rows_of_a_file_cannot_contradict_each_other()
    {
        var p = await CreateProduct(1);
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            db.ProductVariants.Add(new Models.ProductVariant { ProductId = p.Id, ColorCode = "BLA", SizeId = Data.Seed.CatalogSeed.SizeIds.Unitalla, Sku = p.Sku.Replace("NEG", "BLA") });
            await db.SaveChangesAsync(Ct);
        }

        var preview = await Json(await Preview($"{Header},brand\n{p.Sku},x,x,U,1,nike\n{p.Sku.Replace("NEG", "BLA")},x,x,U,1,puma"));

        Assert.Equal("Otra fila del mismo producto trae otro valor en brand.", preview.GetProperty("invalid")[0].GetProperty("error").GetString());
    }

    [Fact]
    public async Task Unit_cost_is_ignored_with_a_warning_when_the_importer_is_not_the_owner()
    {
        // La política deja importar solo al Dueño (§3); la regla de §4.7 se prueba en el servicio.
        var p = await CreateProduct(1, unitCost: 50m);
        using var scope = Factory.Services.CreateScope();
        var import = scope.ServiceProvider.GetRequiredService<IImportInventory>();
        var csv = $"{Header},unit_cost\n{p.Sku},x,x,U,3,10";

        var preview = await import.PreviewAsync(csv, canSeeCosts: false, Ct);
        Assert.Equal(ImportInventory.CostIgnored, Assert.Single(preview.Valid).Warning);
        Assert.Empty(preview.Valid[0].Changes);

        await import.ApplyAsync(csv, canSeeCosts: false, new StaffActor(1, "Prueba"), Ct);
        using var check = Factory.Services.CreateScope();
        var variant = await check.ServiceProvider.GetRequiredService<SokkoDbContext>().ProductVariants.AsNoTracking().SingleAsync(v => v.Id == p.VariantId, Ct);
        Assert.Equal(3, variant.Stock);
        Assert.Equal(50m, variant.UnitCost);
    }

    [Fact]
    public async Task Template_can_be_imported_as_it_is()
    {
        var response = await Get($"{Url}/import/template", Owner);
        Assert.Contains("text/csv", response.Content.Headers.ContentType!.ToString());
        var csv = await response.Content.ReadAsStringAsync(Ct);
        var lines = csv.TrimStart('﻿').Split("\r\n");
        Assert.Equal("SKU,Pieza,Tono,Talla,Stock,line,brand,type,collection,units_per_pack,unit_cost,barcode", lines[0]);
        Assert.Contains(lines, l => l.StartsWith("MRC-001-BLA-S,") && l.EndsWith(",marcas,nike,calcetas,,3,305.00,019523800100"));

        var preview = await Json(await Preview(csv));

        Assert.Equal(0, preview.GetProperty("invalid").GetArrayLength());
    }

    [Fact]
    public async Task Template_without_costs_leaves_unit_cost_empty()
    {
        using var scope = Factory.Services.CreateScope();
        var csv = await scope.ServiceProvider.GetRequiredService<IExportService>().InventoryTemplateAsync(includeCosts: false, Ct);
        Assert.Contains(",marcas,nike,calcetas,,3,,019523800100", csv);
    }
}
