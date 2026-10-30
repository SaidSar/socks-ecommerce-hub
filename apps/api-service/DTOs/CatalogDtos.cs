using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

/// <summary>Filtros de <c>GET /api/products</c> (DESIGN_DB §3.12).</summary>
public class ProductQueryDto
{
    public const int MaxPageSize = 48;

    [RegularExpression("^(sokko|marcas|especiales|accesorios)$", ErrorMessage = "La línea no existe.")]
    public string? Line { get; init; }

    public string? Brand { get; init; }

    public string? Type { get; init; }

    public string? Collection { get; init; }

    /// <summary>Búsqueda: incluye la temporada inactiva con el precio de R-29.</summary>
    public string? Q { get; init; }

    [Range(1, int.MaxValue, ErrorMessage = "La página empieza en 1.")]
    public int Page { get; init; } = 1;

    [Range(1, MaxPageSize, ErrorMessage = "El tamaño de página va de 1 a 48.")]
    public int PageSize { get; init; } = 24;
}

public record PagedResultDto<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);

public record BrandRefDto(string Slug, string Name, bool IsOwnBrand, bool ShowInFilters);

public record ProductTypeRefDto(string Code, string Name, UnitLabel UnitLabel, SizeSystem SizeSystem);

/// <summary>Colección del producto; los campos de ventana son <c>null</c> en una temática.</summary>
public record CollectionRefDto(
    string Slug,
    string Name,
    CollectionKind Kind,
    bool InSeason,
    byte? StartMonth,
    byte? StartDay,
    byte? EndMonth,
    byte? EndDay);

public record ColorDto(string Code, string Slug, string Name, string? Hex, string? LineHex, bool IsSokkoTone);

public record SizeDto(string Code, string Label);

/// <summary><c>Color</c> = <c>Colors.Slug</c>, <c>Size</c> = <c>Sizes.Code</c> y <c>Stock</c> = disponible. Nunca lleva costo (R-30).</summary>
public record ProductVariantDto(string Sku, string Color, string Size, int Stock);

/// <summary>Producto de la tienda. <c>Price</c> es el de lista y <c>FinalPrice</c> el que se cobra (R-29).</summary>
public record ProductDto(
    int Id,
    string Slug,
    ProductLine Line,
    short PieceNumber,
    BrandRefDto Brand,
    ProductTypeRefDto Type,
    CollectionRefDto? Collection,
    string Name,
    string? NameJp,
    string Material,
    string? ImageUrl,
    int? EditionSize,
    byte UnitsPerPack,
    decimal Price,
    decimal FinalPrice,
    bool OffSeason,
    decimal DiscountPct,
    IReadOnlyList<ColorDto> Colors,
    IReadOnlyList<ProductVariantDto> Variants,
    // Solo en la ficha: tabla de tallas según type.sizeSystem.
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<SizeDto>? Sizes = null);

public record HiddenCollectionDto(string Slug, string Name);

public record NavLineDto(string Code, string Label, int Count, int HiddenCount, IReadOnlyList<HiddenCollectionDto> HiddenCollections);

public record NavBrandDto(string Slug, string Name);

public record NavCollectionDto(
    string Slug,
    string Name,
    CollectionKind Kind,
    byte? StartMonth,
    byte? StartDay,
    byte? EndMonth,
    byte? EndDay,
    decimal OffSeasonDiscountPct);

public record NavTypeDto(string Code, string Name);

/// <summary>Datos del menú de la tienda (<c>GET /api/catalog/nav</c>).</summary>
public record CatalogNavDto(
    IReadOnlyList<NavLineDto> Lines,
    IReadOnlyList<NavBrandDto> Brands,
    IReadOnlyList<NavCollectionDto> Collections,
    IReadOnlyList<NavTypeDto> Types,
    string? FeaturedSlug);
