using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Data.Seed;

/// <summary>
/// Semilla de catálogos y configuración (DESIGN_DB §5.1–§5.3, §5.5 y §5.6). Va en la migración con <c>HasData</c>,
/// así que existe en todos los ambientes. Los valores son fijos para que la migración sea determinista.
/// </summary>
public static class CatalogSeed
{
    /// <summary>Fecha de alta de los registros semilla (la del primer esquema, DESIGN_DB v0.1).</summary>
    public static readonly DateTime SeededAt = new(2026, 10, 21, 0, 0, 0, DateTimeKind.Utc);

    public static class SizeIds
    {
        public const int CalcetaS = 1, CalcetaM = 2, CalcetaL = 3;
        public const int GuanteS = 4, GuanteM = 5, GuanteL = 6;
        public const int Unitalla = 7;
    }

    public static class BrandIds
    {
        public const int Sokko = 1, Nike = 2, Puma = 3, UnderArmour = 4, Pokemon = 5, SinMarca = 6;
    }

    public static class ProductTypeIds
    {
        public const int Calcetas = 1, Gorras = 2, Gorros = 3, Guantes = 4, Bufandas = 5, Mangas = 6, Lentes = 7;
    }

    public static class CollectionIds
    {
        public const int Navidad = 1, Halloween = 2, Anime = 3;
    }

    public static Color[] Colors =>
    [
        new() { Code = "SUM", Slug = "sumi", Name = "Tinta Sumi", Hex = "#2C2925", LineHex = "#F4F0EB", IsSokkoTone = true, SortOrder = 1 },
        new() { Code = "WAS", Slug = "washi", Name = "Blanco Washi", Hex = "#EFE8DC", LineHex = "#23211E", IsSokkoTone = true, SortOrder = 2 },
        new() { Code = "LAC", Slug = "laca", Name = "Rojo Laca", Hex = "#9E2F2C", LineHex = "#F4F0EB", IsSokkoTone = true, SortOrder = 3 },
        new() { Code = "MAT", Slug = "matcha", Name = "Oliva Matcha", Hex = "#6E7A5E", LineHex = "#F4F0EB", IsSokkoTone = true, SortOrder = 4 },
        new() { Code = "NEG", Slug = "negro", Name = "Negro", Hex = "#1C1C1C", LineHex = "#F4F0EB", SortOrder = 5 },
        new() { Code = "BLA", Slug = "blanco", Name = "Blanco", Hex = "#FFFFFF", LineHex = "#23211E", SortOrder = 6 },
        new() { Code = "GRI", Slug = "gris", Name = "Gris", Hex = "#8A8A8A", LineHex = "#F4F0EB", SortOrder = 7 },
        new() { Code = "MUL", Slug = "multicolor", Name = "Multicolor", Hex = null, LineHex = null, SortOrder = 8 },
    ];

    public static Size[] Sizes =>
    [
        new() { Id = SizeIds.CalcetaS, SizeSystem = SizeSystem.Calceta, Code = "S", Label = "22–24 cm", SortOrder = 1 },
        new() { Id = SizeIds.CalcetaM, SizeSystem = SizeSystem.Calceta, Code = "M", Label = "25–27 cm", SortOrder = 2 },
        new() { Id = SizeIds.CalcetaL, SizeSystem = SizeSystem.Calceta, Code = "L", Label = "28–30 cm", SortOrder = 3 },
        new() { Id = SizeIds.GuanteS, SizeSystem = SizeSystem.Guante, Code = "S", Label = "Chica", SortOrder = 1 },
        new() { Id = SizeIds.GuanteM, SizeSystem = SizeSystem.Guante, Code = "M", Label = "Mediana", SortOrder = 2 },
        new() { Id = SizeIds.GuanteL, SizeSystem = SizeSystem.Guante, Code = "L", Label = "Grande", SortOrder = 3 },
        new() { Id = SizeIds.Unitalla, SizeSystem = SizeSystem.Unitalla, Code = "U", Label = "Unitalla", SortOrder = 1 },
    ];

    public static Brand[] Brands =>
    [
        new() { Id = BrandIds.Sokko, Name = "SOKKO", Slug = "sokko", IsOwnBrand = true, CreatedAt = SeededAt },
        new() { Id = BrandIds.Nike, Name = "Nike", Slug = "nike", CreatedAt = SeededAt },
        new() { Id = BrandIds.Puma, Name = "Puma", Slug = "puma", CreatedAt = SeededAt },
        new() { Id = BrandIds.UnderArmour, Name = "Under Armour", Slug = "under-armour", CreatedAt = SeededAt },
        new() { Id = BrandIds.Pokemon, Name = "Pokémon", Slug = "pokemon", CreatedAt = SeededAt },
        // P-15: agrupa los genéricos y nunca sale en el filtro de marcas.
        new() { Id = BrandIds.SinMarca, Name = "Sin marca", Slug = "sin-marca", ShowInFilters = false, CreatedAt = SeededAt },
    ];

    public static ProductType[] ProductTypes =>
    [
        new() { Id = ProductTypeIds.Calcetas, Code = "calcetas", Name = "Calcetas", SizeSystem = SizeSystem.Calceta, UnitLabel = UnitLabel.Par, SortOrder = 1 },
        new() { Id = ProductTypeIds.Gorras, Code = "gorras", Name = "Gorras", SizeSystem = SizeSystem.Unitalla, UnitLabel = UnitLabel.Pieza, SortOrder = 2 },
        new() { Id = ProductTypeIds.Gorros, Code = "gorros", Name = "Gorros", SizeSystem = SizeSystem.Unitalla, UnitLabel = UnitLabel.Pieza, SortOrder = 3 },
        new() { Id = ProductTypeIds.Guantes, Code = "guantes", Name = "Guantes", SizeSystem = SizeSystem.Guante, UnitLabel = UnitLabel.Par, SortOrder = 4 },
        new() { Id = ProductTypeIds.Bufandas, Code = "bufandas", Name = "Bufandas", SizeSystem = SizeSystem.Unitalla, UnitLabel = UnitLabel.Pieza, SortOrder = 5 },
        new() { Id = ProductTypeIds.Mangas, Code = "mangas", Name = "Mangas", SizeSystem = SizeSystem.Unitalla, UnitLabel = UnitLabel.Par, SortOrder = 6 },
        new() { Id = ProductTypeIds.Lentes, Code = "lentes", Name = "Lentes", SizeSystem = SizeSystem.Unitalla, UnitLabel = UnitLabel.Pieza, SortOrder = 7 },
    ];

    /// <summary>Ventanas anuales, inclusivas, en hora de Los Mochis (DESIGN_DB §3.5c).</summary>
    public static Collection[] Collections =>
    [
        new()
        {
            Id = CollectionIds.Navidad, Name = "Navidad", Slug = "navidad", Kind = CollectionKind.Temporada,
            StartMonth = 11, StartDay = 1, EndMonth = 1, EndDay = 6, OffSeasonDiscountPct = 0.30m,
            CreatedAt = SeededAt, UpdatedAt = SeededAt,
        },
        new()
        {
            Id = CollectionIds.Halloween, Name = "Halloween", Slug = "halloween", Kind = CollectionKind.Temporada,
            StartMonth = 10, StartDay = 1, EndMonth = 11, EndDay = 2, OffSeasonDiscountPct = 0.30m,
            CreatedAt = SeededAt, UpdatedAt = SeededAt,
        },
        new()
        {
            Id = CollectionIds.Anime, Name = "Anime", Slug = "anime", Kind = CollectionKind.Tematica,
            OffSeasonDiscountPct = 0.30m, CreatedAt = SeededAt, UpdatedAt = SeededAt,
        },
    ];

    /// <summary>
    /// Fila única de configuración (§5.5). <c>FeaturedProductId</c> queda en <c>NULL</c> porque los productos son semilla de
    /// Development; el seeder de desarrollo lo apunta a la pieza 7.
    /// </summary>
    public static Setting Settings => new()
    {
        Id = Setting.SingletonId,
        FreeShippingThreshold = 799.00m,
        ParcelShippingCost = 99.00m,
        LocalShippingCost = 49.00m,
        LocalFreeShipping = true,
        FewUnitsThreshold = 4,
        IvaRate = 0.1600m,
        UpdatedAt = SeededAt,
    };

    public static LocalDeliveryZone[] LocalDeliveryZones =>
    [
        new() { Id = 1, PostalCodeFrom = "81200", PostalCodeTo = "81299", Label = "Los Mochis", IsConfirmed = true, CreatedAt = SeededAt },
        // P-06: por confirmar con el cliente; aplica la tarifa local igual.
        new() { Id = 2, PostalCodeFrom = "81300", PostalCodeTo = "81399", Label = "Ejidos de Ahome", IsConfirmed = false, CreatedAt = SeededAt },
    ];
}
