using System.ComponentModel.DataAnnotations;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.DTOs;

public record AdminBrandRefDto(string Slug, string Name, bool IsOwnBrand);

public record AdminTypeRefDto(string Code, string Name, UnitLabel Unit, SizeSystem SizeSystem);

public record AdminCollectionRefDto(string Slug, string Name, CollectionKind Kind, bool InSeason);

public record AdminColorDto(string Code, string ApiCode, string Name, string? Hex, string? Line, bool IsSokkoTone);

public record AdminVariantDto(string Sku, string Color, string Size, string SizeLabel, string? Barcode, int Stock);

/// <summary>Producto para Operaciones (R-24, R-30): este tipo no tiene ninguna cifra en pesos, no las lleva en <c>null</c>.</summary>
public record OperationsProductDto(
    string Slug,
    ProductLine Line,
    short PieceNumber,
    string Name,
    string? NameJp,
    string Material,
    AdminBrandRefDto Brand,
    AdminTypeRefDto Type,
    byte UnitsPerPack,
    AdminCollectionRefDto? Collection,
    IReadOnlyList<AdminColorDto> Colors,
    IReadOnlyList<AdminVariantDto> Variants,
    int Stock,
    int Sold,
    bool IsActive,
    byte[] RowVersion);

/// <summary>Producto para el Dueño: lo mismo que Operaciones, más precio, costo y margen (R-24, R-30).</summary>
public record OwnerProductDto(
    string Slug,
    ProductLine Line,
    short PieceNumber,
    string Name,
    string? NameJp,
    string Material,
    AdminBrandRefDto Brand,
    AdminTypeRefDto Type,
    byte UnitsPerPack,
    AdminCollectionRefDto? Collection,
    decimal Price,
    decimal? OffSeasonPrice,
    IReadOnlyList<AdminColorDto> Colors,
    IReadOnlyList<AdminVariantDto> Variants,
    int Stock,
    int Sold,
    bool IsActive,
    byte[] RowVersion,
    decimal? UnitCost,
    decimal? Margin);

public class ProductRequestDto
{
    [StringLength(12)]
    public string? Line { get; init; }

    [StringLength(120)]
    public string? Name { get; init; }

    [StringLength(60)]
    public string? NameJp { get; init; }

    [StringLength(200)]
    public string? Material { get; init; }

    public string? Brand { get; init; }

    public string? Type { get; init; }

    public string? Collection { get; init; }

    [Range(1, 24, ErrorMessage = "Las unidades por paquete van de 1 a 24.")]
    public int UnitsPerPack { get; init; } = 1;

    public decimal? Price { get; init; }

    public decimal? UnitCost { get; init; }

    public List<string>? Colors { get; init; }

    /// <summary>SKU → código de barras del proveedor.</summary>
    public Dictionary<string, string?>? Barcodes { get; init; }

    /// <summary><c>false</c> = baja lógica; sin valor, no cambia.</summary>
    public bool? IsActive { get; init; }

    /// <summary>Obligatorio al editar (R-25).</summary>
    public byte[]? RowVersion { get; init; }
}

public record AdminToday(int Year, int Month, int Day);

public record AdminBrandDto(string Slug, string Name, bool IsOwnBrand, bool ShowInFilters, bool IsActive, int Products, IReadOnlyList<ProductLine> Lines, byte[] RowVersion);

public record OwnerCollectionProductDto(string Slug, string Name, decimal Price, decimal? OffSeasonPrice);

public record OperationsCollectionProductDto(string Slug, string Name);

public record OwnerCollectionDto(
    string Slug,
    string Name,
    CollectionKind Kind,
    byte? StartMonth,
    byte? StartDay,
    byte? EndMonth,
    byte? EndDay,
    decimal OffSeasonDiscountPct,
    bool IsActive,
    IReadOnlyList<OwnerCollectionProductDto> Products,
    byte[] RowVersion);

/// <summary>Colección para Operaciones (R-24): sus productos no llevan importes. El descuento es un porcentaje, no una cifra en pesos.</summary>
public record OperationsCollectionDto(
    string Slug,
    string Name,
    CollectionKind Kind,
    byte? StartMonth,
    byte? StartDay,
    byte? EndMonth,
    byte? EndDay,
    decimal OffSeasonDiscountPct,
    bool IsActive,
    IReadOnlyList<OperationsCollectionProductDto> Products,
    byte[] RowVersion);

public record AdminSizeDto(string Code, string Label);

public record AdminProductTypeDto(string Code, string Name, SizeSystem SizeSystem, UnitLabel Unit, bool IsActive, IReadOnlyList<AdminSizeDto> Sizes, int Products, byte[] RowVersion);

/// <summary>Datos de las vistas de Catálogo (<c>GET /api/admin/catalog</c>). Los tipos de producto y colección dependen del rol.</summary>
public record AdminCatalogDto<TProduct, TCollection>(
    AdminToday Today,
    IReadOnlyList<TProduct> Products,
    IReadOnlyList<AdminBrandDto> Brands,
    IReadOnlyList<TCollection> Collections,
    IReadOnlyList<AdminProductTypeDto> Types,
    IReadOnlyDictionary<string, IReadOnlyList<AdminSizeDto>> Sizes,
    IReadOnlyList<AdminColorDto> Colors);
