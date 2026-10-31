using System.Globalization;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de tarea: importación de inventario desde CSV (R-20, DESIGN_ADMIN §5.4 y DESIGN_CATALOG_UI §4.7).</summary>
public interface IImportInventory
{
    /// <summary>Valida sin escribir. <paramref name="canSeeCosts"/> en falso ignora <c>unit_cost</c> con aviso.</summary>
    Task<ImportPreviewDto> PreviewAsync(string? csv, bool canSeeCosts, CancellationToken cancellationToken = default);

    /// <summary>Vuelve a validar y aplica solo las filas válidas, como <c>InventarioInicial</c>.</summary>
    Task<ImportResultDto> ApplyAsync(string? csv, bool canSeeCosts, StaffActor actor, CancellationToken cancellationToken = default);
}

public partial class ImportInventory(SokkoDbContext db, IUnitOfWork unitOfWork, IInventoryService inventory, ICatalogAdminService catalog, IClock clock) : IImportInventory
{
    public const string CostIgnored = "Se ignoró unit_cost: solo el Dueño registra costos.";
    public const string ImportNote = "Importado desde CSV";

    private const string Empty = "El archivo está vacío.";
    private const string BadHeaders = "El archivo necesita las columnas SKU, Pieza, Tono, Talla y Stock, en ese orden.";
    private const string UnknownSku = "El SKU no existe en el catálogo";
    private const string Duplicate = "SKU repetido en el archivo; se usa la primera fila";
    private const string Negative = "El stock no puede ser negativo";
    private const string NotInteger = "El stock debe ser un número entero";
    private const string BadPack = "Las unidades por paquete deben ser un entero de 1 a 12.";
    private const string BadCost = "El costo debe ser un número, por ejemplo 82.50.";
    private const string NegativeCost = "El costo no puede ser negativo.";
    private const string BadBarcode = "El código de barras solo admite letras y números, hasta 32.";
    private const string SokkoBrand = "SOKKO Japón solo admite la marca propia SOKKO.";
    private const string OwnBrandElsewhere = "La marca SOKKO es exclusiva de la línea SOKKO Japón.";
    private const int MaxStock = 1_000_000;
    private const int MaxBarcodeLength = 32;

    private static readonly Dictionary<ProductLine, string> LineCodes = new()
    {
        [ProductLine.Sokko] = "sokko",
        [ProductLine.Marcas] = "marcas",
        [ProductLine.Especiales] = "especiales",
        [ProductLine.Accesorios] = "accesorios",
    };

    private static readonly Dictionary<ProductLine, string> LineLabels = new()
    {
        [ProductLine.Sokko] = "SOKKO",
        [ProductLine.Marcas] = "Marcas",
        [ProductLine.Especiales] = "Especiales",
        [ProductLine.Accesorios] = "Accesorios",
    };

    [GeneratedRegex(@"^-\d+(\.\d+)?$")]
    private static partial Regex NegativeNumber();

    [GeneratedRegex(@"^[0-9]+$")]
    private static partial Regex WholeNumber();

    [GeneratedRegex(@"^-?[0-9]+(\.[0-9]{1,2})?$")]
    private static partial Regex CostNumber();

    private sealed record Context(
        Dictionary<string, ProductVariant> Variants,
        List<Brand> Brands,
        List<ProductType> Types,
        List<Collection> Collections,
        Dictionary<string, string> BarcodeOwners);

    /// <summary>Valores pedidos por producto y códigos ya vistos: las filas de un archivo no pueden contradecirse.</summary>
    private sealed class FileState
    {
        public Dictionary<int, Dictionary<string, object>> Products { get; } = [];
        public Dictionary<string, string> Barcodes { get; } = [];
    }

    private async Task<Context> LoadContextAsync(CancellationToken cancellationToken)
    {
        var variants = await db.ProductVariants
            .AsNoTracking()
            .Where(v => v.IsActive)
            .Include(v => v.Product).ThenInclude(p => p.ProductType)
            .Include(v => v.Product).ThenInclude(p => p.Brand)
            .Include(v => v.Product).ThenInclude(p => p.Collection)
            .ToDictionaryAsync(v => v.Sku, StringComparer.OrdinalIgnoreCase, cancellationToken);
        var owners = await db.ProductVariants
            .AsNoTracking()
            .Where(v => v.Barcode != null)
            .ToDictionaryAsync(v => v.Barcode!, v => v.Sku, cancellationToken);
        return new Context(
            variants,
            await db.Brands.AsNoTracking().Where(b => b.IsActive).ToListAsync(cancellationToken),
            await db.ProductTypes.AsNoTracking().Where(t => t.IsActive).ToListAsync(cancellationToken),
            await db.Collections.AsNoTracking().Where(c => c.IsActive).ToListAsync(cancellationToken),
            owners);
    }

    private static string Unit(ProductVariant v) => OrderAdminService.UnitOf(v.Product.ProductType, v.Product.UnitsPerPack);

    private static bool Same(string a, string b) => InventoryCsv.Normalize(a) == InventoryCsv.Normalize(b);

    private static ImportPreviewDto FileError(string message) => new(message, [], [], [], []);

    private static ImportPreviewDto Validate(string? csv, Context context, bool canSeeCosts)
    {
        var clean = (csv ?? "").TrimStart('﻿');
        var firstLine = clean.Split('\n').Select(l => l.TrimEnd('\r')).FirstOrDefault(l => l.Trim().Length > 0);
        if (firstLine is null)
        {
            return FileError(Empty);
        }

        var table = InventoryCsv.Parse(clean, InventoryCsv.DetectSeparator(firstLine)).Where(r => r.Any(c => c.Trim().Length > 0)).ToList();
        var header = table[0];
        var expected = InventoryCsv.Columns;
        if (header.Count < expected.Length || expected.Where((column, i) => !Same(header[i], column)).Any())
        {
            return FileError(BadHeaders);
        }
        var columns = header.Skip(expected.Length).Select(h => InventoryCsv.Normalize(h).Replace(' ', '_')).ToList();
        var unknown = columns.FindIndex(c => !InventoryCsv.ExtraColumns.Contains(c));
        if (unknown >= 0)
        {
            return FileError($"La columna \"{header[expected.Length + unknown].Trim()}\" no se reconoce. Las opcionales son: {string.Join(", ", InventoryCsv.ExtraColumns)}.");
        }

        var state = new FileState();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var rows = table.Skip(1).Select((cells, index) => ValidateRow(index + 2, cells, columns, context, state, seen, canSeeCosts)).ToList();
        return new ImportPreviewDto("", columns, rows, rows.Where(r => r.Error.Length == 0).ToList(), rows.Where(r => r.Error.Length > 0).ToList());
    }

    private static ImportRowDto ValidateRow(int line, List<string> cells, List<string> columns, Context context, FileState state, HashSet<string> seen, bool canSeeCosts)
    {
        string Cell(int i) => i < cells.Count ? cells[i].Trim() : "";

        var sku = Cell(0).ToUpperInvariant();
        var raw = Cell(4);
        var extra = columns.Select((c, j) => (c, Cell(InventoryCsv.Columns.Length + j))).ToDictionary(x => x.c, x => x.Item2);
        ImportRowDto Row(object stock, string error, IReadOnlyDictionary<string, object>? changes = null, string warning = "") =>
            new(line, sku, Cell(1), Cell(2), Cell(3), stock, extra, changes ?? new Dictionary<string, object>(), warning, error);

        if (!context.Variants.TryGetValue(sku, out var variant))
        {
            return Row(raw, UnknownSku);
        }
        if (!seen.Add(sku))
        {
            return Row(raw, Duplicate);
        }

        var number = string.Concat(raw.Where(c => !char.IsWhiteSpace(c)));
        if (NegativeNumber().IsMatch(number))
        {
            return Row(raw, Negative);
        }
        if (!WholeNumber().IsMatch(number) || !int.TryParse(number, out var stock) || stock > MaxStock)
        {
            return Row(raw, NotInteger);
        }
        // R-27: la importación no puede dejar el stock por debajo de lo apartado.
        if (stock < variant.Reserved)
        {
            return Row(stock, $"El stock ({stock}) es menor que {InventoryMessages.ReservedText(variant.Reserved, Unit(variant))} para pedidos");
        }

        var (error, warning, changes) = ValidateCatalogCells(variant, extra, context, state, canSeeCosts);
        return Row(stock, error, changes, warning);
    }

    /// <summary>Columnas opcionales con las reglas del formulario de producto (R-30, R-31, R-32 y código de barras único). Vacía = no cambia.</summary>
    private static (string Error, string Warning, Dictionary<string, object> Changes) ValidateCatalogCells(
        ProductVariant variant, Dictionary<string, string> extra, Context context, FileState state, bool canSeeCosts)
    {
        var changes = new Dictionary<string, object>();
        var warning = "";
        var product = variant.Product;
        string Get(string column) => extra.GetValueOrDefault(column, "");
        (string, string, Dictionary<string, object>) Fail(string message) => (message, "", []);

        if (Get("line") is { Length: > 0 } lineText)
        {
            var matches = LineCodes.Where(l => Same(l.Value, lineText) || Same(LineLabels[l.Key], lineText)).ToList();
            if (matches.Count == 0)
            {
                return Fail($"La línea \"{lineText}\" no existe (sokko, marcas, especiales o accesorios).");
            }
            if (matches[0].Key != product.Line)
            {
                return Fail($"La línea no coincide con el SKU ({LineLabels[product.Line]}): la línea forma parte del SKU y no cambia.");
            }
        }

        if (Get("type") is { Length: > 0 } typeText)
        {
            var type = context.Types.FirstOrDefault(t => Same(t.Code, typeText) || Same(t.Name, typeText));
            if (type is null)
            {
                return Fail($"El tipo \"{typeText}\" no existe.");
            }
            if (type.Id != product.ProductTypeId)
            {
                return Fail($"El tipo no coincide con el producto ({product.ProductType.Name}): cámbielo desde Productos.");
            }
        }

        var isOwnBrand = product.Brand.IsOwnBrand;
        if (Get("brand") is { Length: > 0 } brandText)
        {
            var brand = context.Brands.FirstOrDefault(b => Same(b.Slug, brandText) || Same(b.Name, brandText));
            if (brand is null)
            {
                return Fail($"La marca \"{brandText}\" no existe; créela en Marcas.");
            }
            changes["brand"] = brand.Slug;
            isOwnBrand = brand.IsOwnBrand;
        }
        if (product.Line == ProductLine.Sokko && !isOwnBrand)
        {
            return Fail(SokkoBrand);
        }
        if (product.Line != ProductLine.Sokko && isOwnBrand)
        {
            return Fail(OwnBrandElsewhere);
        }

        if (Get("collection") is { Length: > 0 } collectionText)
        {
            var collection = context.Collections.FirstOrDefault(c => Same(c.Slug, collectionText) || Same(c.Name, collectionText));
            if (collection is null)
            {
                return Fail($"La colección \"{collectionText}\" no existe.");
            }
            changes["collection"] = collection.Slug;
        }

        if (Get("units_per_pack") is { Length: > 0 } packText)
        {
            if (!WholeNumber().IsMatch(packText) || !int.TryParse(packText, out var pack) || pack is < 1 or > 12)
            {
                return Fail(BadPack);
            }
            changes["unitsPerPack"] = pack;
        }

        if (Get("unit_cost") is { Length: > 0 } costText)
        {
            if (!canSeeCosts)
            {
                warning = CostIgnored;
            }
            else
            {
                var plain = string.Concat(costText.Where(c => c != '$' && !char.IsWhiteSpace(c)));
                if (!CostNumber().IsMatch(plain) || !decimal.TryParse(plain, NumberStyles.Float, CultureInfo.InvariantCulture, out var cost) || cost > 99_999_999m)
                {
                    return Fail(BadCost);
                }
                if (cost < 0)
                {
                    return Fail(NegativeCost); // R-30
                }
                changes["unitCost"] = cost;
            }
        }

        if (Get("barcode") is { Length: > 0 } barcodeText)
        {
            var barcode = string.Concat(barcodeText.Where(c => !char.IsWhiteSpace(c)));
            if (barcode.Length > MaxBarcodeLength || !barcode.All(char.IsAsciiLetterOrDigit))
            {
                return Fail(BadBarcode);
            }
            var owner = state.Barcodes.GetValueOrDefault(barcode) ?? context.BarcodeOwners.GetValueOrDefault(barcode);
            if (owner is not null && owner != variant.Sku)
            {
                return Fail($"Ese código de barras ya está en {owner}.");
            }
            changes["barcode"] = barcode;
        }

        // Las filas de un mismo producto no pueden pedir valores distintos.
        if (!state.Products.TryGetValue(product.Id, out var asked))
        {
            state.Products[product.Id] = asked = [];
        }
        var productLevel = new (string Key, string Column)[] { ("brand", "brand"), ("collection", "collection"), ("unitsPerPack", "units_per_pack"), ("unitCost", "unit_cost") };
        foreach (var (key, column) in productLevel)
        {
            if (changes.TryGetValue(key, out var value) && asked.TryGetValue(key, out var previous) && !value.Equals(previous))
            {
                return Fail($"Otra fila del mismo producto trae otro valor en {column}.");
            }
        }
        foreach (var (key, _) in productLevel)
        {
            if (changes.TryGetValue(key, out var value))
            {
                asked[key] = value;
            }
        }
        if (changes.TryGetValue("barcode", out var code))
        {
            state.Barcodes[(string)code] = variant.Sku;
        }
        return ("", warning, changes);
    }

    public async Task<ImportPreviewDto> PreviewAsync(string? csv, bool canSeeCosts, CancellationToken cancellationToken = default) =>
        Validate(csv, await LoadContextAsync(cancellationToken), canSeeCosts);

    public Task<ImportResultDto> ApplyAsync(string? csv, bool canSeeCosts, StaffActor actor, CancellationToken cancellationToken = default) =>
        unitOfWork.InTransactionAsync(async ct =>
        {
            var context = await LoadContextAsync(ct);
            var preview = Validate(csv, context, canSeeCosts);
            var now = clock.UtcNow;
            var applied = new List<ImportRowDto>();
            // En orden de VariantId, igual que las demás transacciones que tocan varias variantes (DESIGN_DB §4.1).
            foreach (var row in preview.Valid.OrderBy(r => context.Variants[r.Sku].Id))
            {
                var variant = context.Variants[row.Sku];
                var stock = (int)row.Stock;
                // Una venta que llegó después de la lectura cambia la versión: esa fila se omite.
                if (!await inventory.SetStockAsync(new StockChange(variant.Id, stock, stock - variant.Stock, variant.RowVersion, InventoryMovementType.InventarioInicial, ImportNote, null), actor, now, ct))
                {
                    continue;
                }
                applied.Add(row);
            }
            // Después del stock: el costo es por producto y cambia la versión de sus demás variantes.
            foreach (var row in applied)
            {
                await ApplyCatalogChangesAsync(context.Variants[row.Sku], row.Changes, context, ct);
            }
            return (new ImportResultDto(applied.Count, preview.Rows.Count - applied.Count), true);
        }, cancellationToken);

    private async Task ApplyCatalogChangesAsync(ProductVariant variant, IReadOnlyDictionary<string, object> changes, Context context, CancellationToken cancellationToken)
    {
        if (changes.Count == 0)
        {
            return;
        }

        int? brandId = changes.TryGetValue("brand", out var brand) ? context.Brands.First(b => b.Slug == (string)brand).Id : null;
        int? collectionId = changes.TryGetValue("collection", out var collection) ? context.Collections.First(c => c.Slug == (string)collection).Id : null;
        byte? pack = changes.TryGetValue("unitsPerPack", out var units) ? (byte)(int)units : null;
        await catalog.ApplyImportedFieldsAsync(variant.ProductId, brandId, collectionId, pack, clock.UtcNow, cancellationToken);
        await inventory.ApplyCatalogFieldsAsync(
            variant.Id,
            variant.ProductId,
            changes.TryGetValue("unitCost", out var cost) ? (decimal)cost : null,
            changes.TryGetValue("barcode", out var barcode) ? (string)barcode : null,
            cancellationToken);
    }
}
