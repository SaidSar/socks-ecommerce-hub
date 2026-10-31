using System.Globalization;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Precio de un producto en una fecha (R-29). <c>DiscountPct</c>: 0.30 = 30 %.</summary>
public record EffectivePrice(decimal ListPrice, decimal FinalPrice, bool OffSeason, decimal DiscountPct);

/// <summary>Servicio de entidad del catálogo: listados, ficha y menú, con las reglas R-28 y R-29 (DESIGN_DB §6).</summary>
public interface ICatalogService
{
    bool IsInSeason(Product product, DateOnly date);

    EffectivePrice GetEffectivePrice(Product product, DateOnly date);

    Task<PagedResultDto<ProductDto>> ListAsync(ProductQueryDto query, CancellationToken cancellationToken = default);

    /// <summary>También para temporada inactiva; <c>null</c> si no existe o está inactivo.</summary>
    Task<ProductDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default);

    Task<CatalogNavDto> GetNavAsync(CancellationToken cancellationToken = default);
}

public class CatalogService(
    SokkoDbContext db,
    ICollectionService collections,
    ISettingsService settings,
    IClock clock) : ICatalogService
{
    // Orden del menú: SOKKO primero (T-01).
    private static readonly (ProductLine Line, string Label)[] Lines =
    [
        (ProductLine.Sokko, "SOKKO Japón"),
        (ProductLine.Marcas, "Marcas"),
        (ProductLine.Especiales, "Especiales"),
        (ProductLine.Accesorios, "Accesorios"),
    ];

    private const string SearchCollation = "Latin1_General_100_CI_AI";

    /// <summary>Sin mayúsculas ni acentos, para comparar con las etiquetas de línea, que no están en la BD.</summary>
    private static string Normalize(string text) =>
        new string(text.Normalize(NormalizationForm.FormD)
            .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
            .ToArray()).ToLowerInvariant();

    public bool IsInSeason(Product product, DateOnly date) => collections.IsInWindow(product.Collection, date);

    public EffectivePrice GetEffectivePrice(Product product, DateOnly date)
    {
        var discount = collections.GetDiscountPct(product.Collection, date);
        var offSeason = !IsInSeason(product, date);
        var finalPrice = offSeason
            ? Math.Round(product.Price * (1 - discount), 2, MidpointRounding.AwayFromZero)
            : product.Price;
        return new EffectivePrice(product.Price, finalPrice, offSeason, discount);
    }

    public async Task<PagedResultDto<ProductDto>> ListAsync(ProductQueryDto query, CancellationToken cancellationToken = default)
    {
        var today = clock.Today;
        var products = ActiveProducts();

        if (query.Line is not null)
        {
            var line = Enum.Parse<ProductLine>(query.Line, ignoreCase: true);
            products = products.Where(p => p.Line == line);
        }
        if (!string.IsNullOrWhiteSpace(query.Brand))
        {
            products = products.Where(p => p.Brand.Slug == query.Brand);
        }
        if (!string.IsNullOrWhiteSpace(query.Type))
        {
            products = products.Where(p => p.ProductType.Code == query.Type);
        }
        if (!string.IsNullOrWhiteSpace(query.Collection))
        {
            products = products.Where(p => p.Collection != null && p.Collection.Slug == query.Collection);
        }

        if (string.IsNullOrWhiteSpace(query.Q))
        {
            products = collections.WhereInSeason(products, today);
        }
        else
        {
            // La intercalación de la BD distingue ñ de n; esta no, igual que el buscador de la tienda.
            var term = query.Q.Trim();
            var lines = Lines.Where(l => Normalize(l.Label).Contains(Normalize(term))).Select(l => l.Line).ToList();
            products = products.Where(p =>
                EF.Functions.Collate(p.Name, SearchCollation).Contains(term)
                || EF.Functions.Collate(p.Material, SearchCollation).Contains(term)
                || EF.Functions.Collate(p.Brand.Name, SearchCollation).Contains(term)
                || EF.Functions.Collate(p.ProductType.Name, SearchCollation).Contains(term)
                || (p.Collection != null && EF.Functions.Collate(p.Collection.Name, SearchCollation).Contains(term))
                || lines.Contains(p.Line));
        }

        var total = await products.CountAsync(cancellationToken);
        var page = await WithDetails(products)
            .OrderBy(p => p.Line == ProductLine.Sokko ? 0 : p.Line == ProductLine.Marcas ? 1 : p.Line == ProductLine.Especiales ? 2 : 3)
            .ThenBy(p => p.CreatedAt)
            .ThenBy(p => p.PieceNumber)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        return new PagedResultDto<ProductDto>(page.Select(p => ToDto(p, today)).ToList(), total, query.Page, query.PageSize);
    }

    public async Task<ProductDto?> GetBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        var product = await WithDetails(ActiveProducts()).FirstOrDefaultAsync(p => p.Slug == slug, cancellationToken);
        if (product is null)
        {
            return null;
        }

        var sizes = await db.Sizes
            .AsNoTracking()
            .Where(s => s.SizeSystem == product.ProductType.SizeSystem && s.IsActive)
            .OrderBy(s => s.SortOrder)
            .Select(s => new SizeDto(s.Code, s.Label))
            .ToListAsync(cancellationToken);

        return ToDto(product, clock.Today) with { Sizes = sizes };
    }

    public async Task<CatalogNavDto> GetNavAsync(CancellationToken cancellationToken = default)
    {
        var today = clock.Today;
        var products = await ActiveProducts()
            .Include(p => p.Brand)
            .Include(p => p.ProductType)
            .Include(p => p.Collection)
            .ToListAsync(cancellationToken);
        var visible = products.Where(p => IsInSeason(p, today)).ToList();
        var activeCollections = await collections.ListActiveAsync(today, cancellationToken);

        var lines = Lines.Select(l =>
        {
            var hidden = products.Where(p => p.Line == l.Line && !IsInSeason(p, today)).ToList();
            return new NavLineDto(
                ApiCode(l.Line),
                l.Label,
                visible.Count(p => p.Line == l.Line),
                hidden.Count,
                hidden.Select(p => p.Collection!)
                    .DistinctBy(c => c.Id)
                    .Select(c => new HiddenCollectionDto(c.Slug, c.Name))
                    .ToList());
        }).ToList();

        var brands = visible
            .Select(p => p.Brand)
            .Where(b => b.ShowInFilters)
            .DistinctBy(b => b.Id)
            .OrderBy(b => b.Id)
            .Select(b => new NavBrandDto(b.Slug, b.Name))
            .ToList();

        var types = visible
            .Select(p => p.ProductType)
            .DistinctBy(t => t.Id)
            .OrderBy(t => t.SortOrder)
            .Select(t => new NavTypeDto(t.Code, t.Name))
            .ToList();

        var navCollections = activeCollections
            .Select(c => new NavCollectionDto(c.Slug, c.Name, c.Kind, c.StartMonth, c.StartDay, c.EndMonth, c.EndDay, c.OffSeasonDiscountPct))
            .ToList();

        return new CatalogNavDto(lines, brands, navCollections, types, await settings.GetFeaturedSlugAsync(cancellationToken));
    }

    private IQueryable<Product> ActiveProducts() => db.Products.AsNoTracking().Where(p => p.IsActive);

    private static IQueryable<Product> WithDetails(IQueryable<Product> products) =>
        products
            .Include(p => p.Brand)
            .Include(p => p.ProductType)
            .Include(p => p.Collection)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Color)
            .Include(p => p.Variants.Where(v => v.IsActive)).ThenInclude(v => v.Size)
            .AsSplitQuery();

    private ProductDto ToDto(Product product, DateOnly today)
    {
        var price = GetEffectivePrice(product, today);
        var collection = product.Collection;
        // Orden de alta: el primer color es el que muestra la tarjeta.
        var variants = product.Variants.OrderBy(v => v.Id).ToList();

        return new ProductDto(
            product.Id,
            product.Slug,
            product.Line,
            product.PieceNumber,
            new BrandRefDto(product.Brand.Slug, product.Brand.Name, product.Brand.IsOwnBrand, product.Brand.ShowInFilters),
            new ProductTypeRefDto(product.ProductType.Code, product.ProductType.Name, product.ProductType.UnitLabel, product.ProductType.SizeSystem),
            collection is null
                ? null
                : new CollectionRefDto(
                    collection.Slug,
                    collection.Name,
                    collection.Kind,
                    IsInSeason(product, today),
                    collection.StartMonth,
                    collection.StartDay,
                    collection.EndMonth,
                    collection.EndDay),
            product.Name,
            product.NameJp,
            product.Material,
            product.ImageUrl,
            product.EditionSize,
            product.UnitsPerPack,
            price.ListPrice,
            price.FinalPrice,
            price.OffSeason,
            price.DiscountPct,
            variants
                .Select(v => v.Color)
                .DistinctBy(c => c.Code)
                .Select(c => new ColorDto(c.Code, c.Slug, c.Name, c.Hex, c.LineHex, c.IsSokkoTone))
                .ToList(),
            variants
                .Select(v => new ProductVariantDto(v.Sku, v.Color.Slug, v.Size.Code, v.Stock - v.Reserved))
                .ToList());
    }

    private static string ApiCode(ProductLine line) => line.ToString().ToLowerInvariant();
}
