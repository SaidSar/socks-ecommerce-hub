using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Producto completo dentro del servicio. Sale a la API solo por <see cref="ToOwner"/> o <see cref="ToOperations"/> (R-24).</summary>
public record AdminProductView(OperationsProductDto Base, decimal? UnitCost, decimal? Margin)
{
    public OperationsProductDto ToOperations() => Base;

    public OwnerProductDto ToOwner() => new(
        Base.Slug, Base.Line, Base.PieceNumber, Base.Name, Base.NameJp, Base.Material, Base.Brand, Base.Type, Base.UnitsPerPack, Base.Collection,
        Base.Price, Base.OffSeasonPrice, Base.Colors, Base.Variants, Base.Stock, Base.Sold, Base.IsActive, Base.RowVersion, UnitCost, Margin);
}

public record AdminCatalogView(
    AdminToday Today,
    IReadOnlyList<AdminProductView> Products,
    IReadOnlyList<AdminBrandDto> Brands,
    IReadOnlyList<AdminCollectionDto> Collections,
    IReadOnlyList<AdminProductTypeDto> Types,
    IReadOnlyDictionary<string, IReadOnlyList<AdminSizeDto>> Sizes,
    IReadOnlyList<AdminColorDto> Colors)
{
    public AdminCatalogDto<OwnerProductDto> ToOwner() => new(Today, Products.Select(p => p.ToOwner()).ToList(), Brands, Collections, Types, Sizes, Colors);

    public AdminCatalogDto<OperationsProductDto> ToOperations() => new(Today, Products.Select(p => p.ToOperations()).ToList(), Brands, Collections, Types, Sizes, Colors);
}

/// <summary>Servicio de entidad: productos del panel (DESIGN_CATALOG_UI §4.3). Las variantes las escribe <see cref="IInventoryService"/>.</summary>
public interface ICatalogAdminService
{
    Task<AdminCatalogView> GetCatalogAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AdminProductView>> ListProductsAsync(CancellationToken cancellationToken = default);

    Task<AdminProductView?> GetProductAsync(string slug, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminProductView>> CreateProductAsync(ProductRequestDto request, CancellationToken cancellationToken = default);

    Task<AdminResult<AdminProductView>> UpdateProductAsync(string slug, ProductRequestDto request, CancellationToken cancellationToken = default);
}

public class CatalogAdminService(
    SokkoDbContext db,
    IUnitOfWork unitOfWork,
    IInventoryService inventory,
    ICatalogService catalog,
    IClock clock) : ICatalogAdminService
{
    private const int MaxPieceNumber = 999;

    private static readonly Dictionary<ProductLine, string> SkuPrefixes = new()
    {
        [ProductLine.Sokko] = "SKK",
        [ProductLine.Marcas] = "MRC",
        [ProductLine.Especiales] = "ESP",
        [ProductLine.Accesorios] = "ACC",
    };

    public static string SizeSystemKey(SizeSystem system) => system.ToString().ToLowerInvariant();

    public static string Slugify(string text)
    {
        var plain = new string(text.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray()).ToLowerInvariant();
        var slug = new StringBuilder();
        foreach (var c in plain)
        {
            if (char.IsAsciiLetterOrDigit(c))
            {
                slug.Append(c);
            }
            else if (slug.Length > 0 && slug[^1] != '-')
            {
                slug.Append('-');
            }
        }
        return slug.ToString().TrimEnd('-');
    }

    private IQueryable<Product> ProductsWithDetails() =>
        db.Products
            .AsNoTracking()
            .Include(p => p.Brand)
            .Include(p => p.ProductType)
            .Include(p => p.Collection)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Color)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Size)
            .AsSplitQuery();

    private static AdminColorDto ColorDto(Color c) => new(c.Code, c.Slug, c.Name, c.Hex, c.LineHex, c.IsSokkoTone);

    private async Task<Dictionary<int, int>> SoldByProductAsync(CancellationToken cancellationToken) =>
        await db.OrderItems
            .AsNoTracking()
            .Where(i => i.Order.Status != OrderStatus.Cancelado)
            .GroupBy(i => i.Variant.ProductId)
            .Select(g => new { ProductId = g.Key, Units = g.Sum(i => i.Quantity) })
            .ToDictionaryAsync(x => x.ProductId, x => x.Units, cancellationToken);

    private AdminProductView ToView(Product p, int sold, DateOnly today)
    {
        var price = catalog.GetEffectivePrice(p, today);
        var variants = p.Variants.OrderBy(v => v.Id).ToList();
        // El panel captura el costo por producto y lo aplica a sus variantes (T-09).
        var unitCost = variants.Select(v => v.UnitCost).FirstOrDefault();
        var margin = unitCost is { } cost && p.Price > 0 ? Math.Round((p.Price - cost) / p.Price, 4, MidpointRounding.AwayFromZero) : (decimal?)null;

        return new AdminProductView(
            new OperationsProductDto(
                p.Slug,
                p.Line,
                p.PieceNumber,
                p.Name,
                p.NameJp,
                p.Material,
                new AdminBrandRefDto(p.Brand.Slug, p.Brand.Name, p.Brand.IsOwnBrand),
                new AdminTypeRefDto(p.ProductType.Code, p.ProductType.Name, p.ProductType.UnitLabel, p.ProductType.SizeSystem),
                p.UnitsPerPack,
                p.Collection is null ? null : new AdminCollectionRefDto(p.Collection.Slug, p.Collection.Name, p.Collection.Kind, catalog.IsInSeason(p, today)),
                p.Price,
                price.OffSeason ? price.FinalPrice : null,
                variants.Select(v => v.Color).DistinctBy(c => c.Code).Select(ColorDto).ToList(),
                variants.Select(v => new AdminVariantDto(v.Sku, v.ColorCode, v.Size.Code, v.Size.Label, v.Barcode, v.Stock)).ToList(),
                variants.Sum(v => v.Stock),
                sold,
                p.IsActive,
                p.RowVersion),
            unitCost,
            margin);
    }

    public async Task<IReadOnlyList<AdminProductView>> ListProductsAsync(CancellationToken cancellationToken = default)
    {
        var today = clock.Today;
        var sold = await SoldByProductAsync(cancellationToken);
        var products = await ProductsWithDetails()
            .OrderBy(p => p.Line == ProductLine.Sokko ? 0 : p.Line == ProductLine.Marcas ? 1 : p.Line == ProductLine.Especiales ? 2 : 3)
            .ThenBy(p => p.CreatedAt)
            .ThenBy(p => p.PieceNumber)
            .ToListAsync(cancellationToken);
        return products.Select(p => ToView(p, sold.GetValueOrDefault(p.Id), today)).ToList();
    }

    public async Task<AdminProductView?> GetProductAsync(string slug, CancellationToken cancellationToken = default)
    {
        var product = await ProductsWithDetails().FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);
        if (product is null)
        {
            return null;
        }
        var sold = await SoldByProductAsync(cancellationToken);
        return ToView(product, sold.GetValueOrDefault(product.Id), clock.Today);
    }

    public async Task<AdminCatalogView> GetCatalogAsync(CancellationToken cancellationToken = default)
    {
        var today = clock.Today;
        var products = await ListProductsAsync(cancellationToken);
        var active = products.Where(p => p.Base.IsActive).ToList();

        var sizes = await db.Sizes.AsNoTracking().Where(s => s.IsActive).OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);
        var sizesBySystem = sizes
            .GroupBy(s => s.SizeSystem)
            .ToDictionary(g => SizeSystemKey(g.Key), g => (IReadOnlyList<AdminSizeDto>)g.Select(s => new AdminSizeDto(s.Code, s.Label)).ToList());

        var brands = (await db.Brands.AsNoTracking().OrderBy(b => b.Id).ToListAsync(cancellationToken))
            .Select(b =>
            {
                var own = active.Where(p => p.Base.Brand.Slug == b.Slug).ToList();
                return new AdminBrandDto(b.Slug, b.Name, b.IsOwnBrand, b.ShowInFilters, b.IsActive, own.Count, own.Select(p => p.Base.Line).Distinct().Order().ToList(), b.RowVersion);
            })
            .ToList();

        var collectionDtos = (await db.Collections.AsNoTracking().OrderBy(c => c.Id).ToListAsync(cancellationToken))
            .Select(c => new AdminCollectionDto(
                c.Slug, c.Name, c.Kind, c.StartMonth, c.StartDay, c.EndMonth, c.EndDay, c.OffSeasonDiscountPct, c.IsActive,
                active.Where(p => p.Base.Collection?.Slug == c.Slug).Select(p => new AdminCollectionProductDto(p.Base.Slug, p.Base.Name, p.Base.Price, p.Base.OffSeasonPrice)).ToList(),
                c.RowVersion))
            .ToList();

        var types = (await db.ProductTypes.AsNoTracking().OrderBy(t => t.SortOrder).ToListAsync(cancellationToken))
            .Select(t => new AdminProductTypeDto(t.Code, t.Name, t.SizeSystem, t.UnitLabel, t.IsActive, sizesBySystem.GetValueOrDefault(SizeSystemKey(t.SizeSystem)) ?? [], active.Count(p => p.Base.Type.Code == t.Code), t.RowVersion))
            .ToList();

        var colors = await db.Colors.AsNoTracking().Where(c => c.IsActive).OrderBy(c => c.SortOrder).ToListAsync(cancellationToken);

        return new AdminCatalogView(new AdminToday(today.Year, today.Month, today.Day), products, brands, collectionDtos, types, sizesBySystem, colors.Select(ColorDto).ToList());
    }

    public Task<AdminResult<AdminProductView>> CreateProductAsync(ProductRequestDto request, CancellationToken cancellationToken = default) =>
        SaveAsync(null, request, cancellationToken);

    public Task<AdminResult<AdminProductView>> UpdateProductAsync(string slug, ProductRequestDto request, CancellationToken cancellationToken = default) =>
        SaveAsync(slug, request, cancellationToken);

    private async Task<AdminResult<AdminProductView>> SaveAsync(string? slug, ProductRequestDto request, CancellationToken cancellationToken)
    {
        var saved = await unitOfWork.InTransactionAsync<(AdminResult<AdminProductView>? Failure, string? Slug)>(async ct =>
        {
            var (failure, savedSlug) = await SaveInTransactionAsync(slug, request, ct);
            return ((failure, savedSlug), failure is null);
        }, cancellationToken);

        return saved.Failure ?? AdminResult<AdminProductView>.Ok((await GetProductAsync(saved.Slug!, cancellationToken))!);
    }

    private async Task<(AdminResult<AdminProductView>? Failure, string? Slug)> SaveInTransactionAsync(string? slug, ProductRequestDto request, CancellationToken cancellationToken)
    {
        var existing = slug is null ? null : await db.Products.FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);
        if (slug is not null && existing is null)
        {
            return (AdminResult<AdminProductView>.NotFound("No encontramos ese producto."), null);
        }

        var errors = new Dictionary<string, string>();
        var line = existing?.Line ?? ParseLine(request.Line);
        if (line is null)
        {
            errors["line"] = "Elige una línea.";
        }
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            errors["name"] = "Escribe el nombre del producto.";
        }
        if (request.Price is not > 0)
        {
            errors["price"] = "Escribe un precio mayor a 0.";
        }
        if (request.UnitCost is < 0)
        {
            errors["unitCost"] = "El costo no puede ser negativo."; // R-30
        }
        if (existing is not null && request.RowVersion is null)
        {
            errors["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage;
        }

        var brand = await db.Brands.FirstOrDefaultAsync(b => b.Slug == request.Brand && b.IsActive, cancellationToken);
        if (brand is null)
        {
            errors["brand"] = "Elige una marca.";
        }
        else if (line == ProductLine.Sokko && !brand.IsOwnBrand)
        {
            errors["brand"] = "SOKKO Japón solo admite la marca propia SOKKO."; // R-32
        }
        else if (line is not null && line != ProductLine.Sokko && brand.IsOwnBrand)
        {
            errors["brand"] = "La marca SOKKO es exclusiva de la línea SOKKO Japón."; // R-32
        }

        var type = await db.ProductTypes.FirstOrDefaultAsync(t => t.Code == request.Type && t.IsActive, cancellationToken);
        if (type is null)
        {
            errors["type"] = "Elige un tipo.";
        }
        else if (existing is not null && existing.ProductTypeId != type.Id)
        {
            // R-32: las tallas de sus SKU tienen que ser del sistema del tipo.
            var currentSystem = await db.ProductTypes.Where(t => t.Id == existing.ProductTypeId).Select(t => t.SizeSystem).FirstAsync(cancellationToken);
            if (currentSystem != type.SizeSystem)
            {
                errors["type"] = "Este producto ya tiene variantes con otro sistema de tallas; no se puede cambiar a este tipo.";
            }
        }

        Collection? collection = null;
        if (!string.IsNullOrWhiteSpace(request.Collection))
        {
            collection = await db.Collections.FirstOrDefaultAsync(c => c.Slug == request.Collection && c.IsActive, cancellationToken);
            if (collection is null)
            {
                errors["collection"] = "Esa colección no existe.";
            }
        }
        else if (line == ProductLine.Especiales)
        {
            errors["collection"] = "Elige una colección: es obligatoria en Especiales."; // R-31
        }

        if (line == ProductLine.Sokko && string.IsNullOrWhiteSpace(request.NameJp ?? existing?.NameJp))
        {
            errors["nameJp"] = "Escribe el nombre en japonés: es obligatorio en SOKKO Japón.";
        }

        var codes = (request.Colors ?? []).Distinct().ToList();
        var colors = await db.Colors.Where(c => codes.Contains(c.Code) && c.IsActive).ToListAsync(cancellationToken);
        if (codes.Count == 0 || colors.Count != codes.Count)
        {
            errors["colors"] = "Elige al menos un color.";
        }
        else if (line == ProductLine.Sokko && colors.Any(c => !c.IsSokkoTone))
        {
            errors["colors"] = "SOKKO Japón solo admite los tonos Kyoto."; // R-32
        }
        else if (line is not null && line != ProductLine.Sokko && colors.Any(c => c.IsSokkoTone))
        {
            errors["colors"] = $"Los tonos Kyoto ({string.Join(", ", colors.Where(c => c.IsSokkoTone).Select(c => c.Name))}) son exclusivos de SOKKO Japón."; // R-32
        }

        short piece = 0;
        if (line is { } knownLine)
        {
            piece = existing?.PieceNumber ?? await NextPieceAsync(knownLine, cancellationToken);
            if (piece > MaxPieceNumber)
            {
                errors["line"] = "Esta línea ya no tiene números de pieza disponibles.";
            }
        }

        var specs = new List<VariantSpec>();
        if (line is { } specLine && type is not null && !errors.ContainsKey("colors"))
        {
            var sizes = await db.Sizes.Where(s => s.SizeSystem == type.SizeSystem && s.IsActive).OrderBy(s => s.SortOrder).ToListAsync(cancellationToken);
            foreach (var code in codes)
            {
                foreach (var size in sizes)
                {
                    var sku = $"{SkuPrefixes[specLine]}-{piece:000}-{code}-{size.Code}";
                    var barcode = request.Barcodes?.GetValueOrDefault(sku)?.Trim();
                    specs.Add(new VariantSpec(sku, code, size.Id, string.IsNullOrEmpty(barcode) ? null : barcode, request.UnitCost));
                }
            }
            await ValidateBarcodesAsync(specs, existing?.Id, errors, cancellationToken);
        }

        if (errors.Count > 0)
        {
            return (AdminResult<AdminProductView>.Invalid(errors), null);
        }

        var now = clock.UtcNow;
        var product = existing;
        if (product is null)
        {
            product = new Product
            {
                Line = line!.Value,
                PieceNumber = piece,
                Slug = await UniqueSlugAsync(request.Name!, piece, cancellationToken),
                CreatedAt = now,
            };
            db.Products.Add(product);
        }
        else
        {
            db.Entry(product).Property(p => p.RowVersion).OriginalValue = request.RowVersion!;
        }

        product.BrandId = brand!.Id;
        product.ProductTypeId = type!.Id;
        product.CollectionId = collection?.Id;
        product.Name = request.Name!.Trim();
        product.NameJp = string.IsNullOrWhiteSpace(request.NameJp) ? existing?.NameJp : request.NameJp.Trim();
        product.Material = request.Material?.Trim() ?? existing?.Material ?? "";
        product.Price = request.Price!.Value;
        product.UnitsPerPack = (byte)request.UnitsPerPack;
        product.IsActive = request.IsActive ?? existing?.IsActive ?? true;
        // Siempre cambia: así toda edición pasa por la comprobación de RowVersion, aunque solo toque variantes.
        product.UpdatedAt = now;
        await db.SaveChangesAsync(cancellationToken);

        var blocked = await inventory.SyncVariantsAsync(product.Id, specs, cancellationToken);
        if (blocked.Count > 0)
        {
            return (AdminResult<AdminProductView>.Conflict(
                "Hay variantes con unidades apartadas para pedidos.",
                new Dictionary<string, string> { ["colors"] = $"No se puede quitar {string.Join(", ", blocked)}: tiene unidades apartadas para pedidos." }), null);
        }
        return (null, product.Slug);
    }

    private static ProductLine? ParseLine(string? line) =>
        line is "sokko" or "marcas" or "especiales" or "accesorios" ? Enum.Parse<ProductLine>(line, ignoreCase: true) : null;

    private async Task<short> NextPieceAsync(ProductLine line, CancellationToken cancellationToken)
    {
        var max = await db.Products.Where(p => p.Line == line).Select(p => (int?)p.PieceNumber).MaxAsync(cancellationToken);
        return (short)((max ?? 0) + 1);
    }

    private async Task<string> UniqueSlugAsync(string name, short piece, CancellationToken cancellationToken)
    {
        var slug = Slugify(name);
        if (slug.Length == 0)
        {
            return $"producto-{Guid.NewGuid():N}";
        }
        return await db.Products.AnyAsync(p => p.Slug == slug, cancellationToken) ? $"{slug}-{piece}" : slug;
    }

    /// <summary>Código de barras único entre los que no son nulos (T-12); en el error se dice qué SKU ya lo tiene.</summary>
    private async Task ValidateBarcodesAsync(IReadOnlyList<VariantSpec> specs, int? productId, Dictionary<string, string> errors, CancellationToken cancellationToken)
    {
        var seen = new HashSet<string>();
        foreach (var spec in specs.Where(s => s.Barcode is not null))
        {
            if (!seen.Add(spec.Barcode!))
            {
                errors[$"barcode:{spec.Sku}"] = "Ese código de barras se repite en este producto.";
            }
            else if (spec.Barcode!.Length > 32 || !spec.Barcode.All(char.IsAsciiLetterOrDigit))
            {
                errors[$"barcode:{spec.Sku}"] = "El código de barras solo admite letras y números, hasta 32.";
            }
        }

        var owners = await db.ProductVariants
            .AsNoTracking()
            .Where(v => v.Barcode != null && seen.Contains(v.Barcode) && v.ProductId != productId)
            .Select(v => new { v.Barcode, v.Sku })
            .ToListAsync(cancellationToken);
        foreach (var owner in owners)
        {
            var spec = specs.First(s => s.Barcode == owner.Barcode);
            errors[$"barcode:{spec.Sku}"] = $"Ese código de barras ya está en {owner.Sku}.";
        }
    }
}
