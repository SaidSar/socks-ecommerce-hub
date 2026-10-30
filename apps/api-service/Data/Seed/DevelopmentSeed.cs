using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.Seed.CatalogSeed;

namespace Sokko.Api.Data.Seed;

/// <summary>
/// Datos de ejemplo solo para Development (DESIGN_DB §5.4, §5.4a y §5.7): los 24 productos de
/// <c>apps/web-store/src/data/catalogSeed.js</c>, 120 SKU con su stock inicial y los usuarios demo.
/// Los aplica <see cref="DevelopmentDataSeeder"/>; nunca van en la migración.
/// </summary>
public static class DevelopmentSeed
{
    public const string SeedActorName = "Semilla";
    public const string InitialInventoryNote = "Inventario inicial de semilla";
    public const string AlignmentNote = "Ajuste de semilla: alineada con la tienda";

    /// <summary>Pieza del hero (<c>Settings.FeaturedProductId</c>): Tabi Origami Noche.</summary>
    public const int FeaturedProductId = 7;

    /// <summary>Productos de la semilla v0.4.3 que ya no existen y ocupan piezas y SKU de los nuevos.</summary>
    public static readonly string[] RetiredSlugs =
    [
        "nike-everyday-paquete-3", "puma-deportiva-tobillera", "calceta-navidena-copo", "calceta-calabaza",
        "calceta-pokemon-pikachu", "gorro-tejido", "guantes-termicos", "lentes-de-sol",
    ];

    private sealed record SeedProduct(
        ProductLine Line, short Piece, string Slug, int BrandId, int TypeId, int? CollectionId, string Name, string Material,
        decimal Price, int Stock, decimal? UnitCost, string[] Colors, string? NameJp = null, byte UnitsPerPack = 1, int? EditionSize = null);

    /// <summary>Mismo orden que <c>catalogSeed.js</c>; los costos salen de <c>apps/admin-panel/src/data/catalogAdmin.js</c>.</summary>
    private static readonly SeedProduct[] Catalog =
    [
        new(ProductLine.Sokko, 7, "tabi-origami-noche", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Tabi Origami Noche", "Algodón peinado D-200 · pliegue en empeine", 420m, 15, 168m, ["SUM", "WAS"], "折紙・夜", EditionSize: 120),
        new(ProductLine.Sokko, 12, "lino-komorebi", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Lino Komorebi", "Lino y algodón · tinte de té verde", 380m, 13, 152m, ["MAT", "WAS"], "木漏れ日"),
        new(ProductLine.Sokko, 3, "kintsugi-washi", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Kintsugi Washi", "Algodón peinado · costura dorada visible", 460m, 3, 190m, ["WAS", "SUM", "LAC"], "金継ぎ", EditionSize: 80),
        new(ProductLine.Sokko, 21, "hanami-laca", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Hanami Laca", "Algodón peinado · pigmento mineral rojo", 395m, 26, 158m, ["LAC", "WAS"], "花見"),
        new(ProductLine.Sokko, 15, "tsuchi-raiz", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Tsuchi Raíz", "Algodón y bambú · teñido con tierra ocre", 360m, 17, null, ["MAT", "SUM"], "土"),
        new(ProductLine.Sokko, 9, "mizu-calma", BrandIds.Sokko, ProductTypeIds.Calcetas, null, "Mizu Calma", "Algodón peinado · punto tubular sin costura", 340m, 37, 128m, ["WAS", "MAT", "SUM"], "水"),

        new(ProductLine.Marcas, 1, "nike-everyday-cushion-3", BrandIds.Nike, ProductTypeIds.Calcetas, null, "Everyday Cushion Crew", "Algodón con amortiguación en planta", 449m, 22, 305m, ["BLA", "NEG"], UnitsPerPack: 3),
        new(ProductLine.Marcas, 2, "puma-quarter-3", BrandIds.Puma, ProductTypeIds.Calcetas, null, "Quarter Sport", "Tobillera deportiva", 329m, 18, 214m, ["NEG", "GRI"], UnitsPerPack: 3),
        new(ProductLine.Marcas, 3, "ua-heatgear-crew", BrandIds.UnderArmour, ProductTypeIds.Calcetas, null, "HeatGear Crew", "Tejido que evacúa la humedad", 189m, 4, 121m, ["NEG", "BLA"]),
        new(ProductLine.Marcas, 4, "nike-elite-basketball", BrandIds.Nike, ProductTypeIds.Calcetas, null, "Elite Basketball Crew", "Soporte en arco y talón", 299m, 9, 196m, ["BLA", "ROJ"]),

        new(ProductLine.Especiales, 1, "copo-navideno", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Navidad, "Copo Navideño", "Tejido jacquard de invierno", 199m, 30, 82m, ["ROJ", "VER"]),
        new(ProductLine.Especiales, 2, "reno-de-lana", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Navidad, "Reno de Lana", "Mezcla de lana suave", 219m, 12, 95m, ["ROJ"]),
        new(ProductLine.Especiales, 3, "duendes-del-bosque", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Navidad, "Duendes del Bosque", "Algodón con puño a rayas", 189m, 17, 80m, ["VER", "ROJ"]),
        new(ProductLine.Especiales, 4, "calabaza-nocturna", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Halloween, "Calabaza Nocturna", "Algodón con estampado nocturno", 179m, 21, 70m, ["NAR", "NEG"]),
        new(ProductLine.Especiales, 5, "telarana-nocturna", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Halloween, "Telaraña Nocturna", "Algodón con estampado nocturno", 169m, 9, 66m, ["NEG", "NAR"]),
        new(ProductLine.Especiales, 6, "luna-de-calabazas", BrandIds.SinMarca, ProductTypeIds.Calcetas, CollectionIds.Halloween, "Luna de Calabazas", "Tobillera de algodón", 189m, 4, 74m, ["NAR"]),
        new(ProductLine.Especiales, 7, "pokemon-pikachu", BrandIds.Pokemon, ProductTypeIds.Calcetas, CollectionIds.Anime, "Calceta Pokémon Pikachu", "Licencia oficial Pokémon", 239m, 14, 140m, ["AMA"]),
        new(ProductLine.Especiales, 8, "marvel-avengers", BrandIds.Marvel, ProductTypeIds.Calcetas, CollectionIds.Superheroes, "Marvel Avengers", "Licencia oficial Marvel", 229m, 3, 135m, ["AZU", "ROJ"]),

        new(ProductLine.Accesorios, 1, "gorro-de-punto", BrandIds.SinMarca, ProductTypeIds.Gorros, null, "Gorro de punto", "Punto acanalado doble", 249m, 16, 98m, ["NEG", "CAM"]),
        new(ProductLine.Accesorios, 2, "guantes-tactiles", BrandIds.SinMarca, ProductTypeIds.Guantes, null, "Guantes táctiles", "Yemas para pantalla táctil", 199m, 11, 84m, ["NEG", "GRI"]),
        new(ProductLine.Accesorios, 3, "bufanda-de-lana", BrandIds.SinMarca, ProductTypeIds.Bufandas, null, "Bufanda de lana", "180 × 30 cm", 289m, 8, 120m, ["CAM", "GRI"]),
        new(ProductLine.Accesorios, 4, "gorra-nike-club", BrandIds.Nike, ProductTypeIds.Gorras, null, "Gorra Club", "Ajustable", 499m, 6, 340m, ["NEG", "BLA"]),
        new(ProductLine.Accesorios, 5, "lentes-de-sol-polarizados", BrandIds.SinMarca, ProductTypeIds.Lentes, null, "Lentes de sol polarizados", "UV400 con estuche", 299m, 2, 110m, ["NEG"]),
        new(ProductLine.Accesorios, 6, "mangas-uv", BrandIds.SinMarca, ProductTypeIds.Mangas, null, "Mangas UV", "Protección solar", 149m, 19, 52m, ["NEG", "BLA"]),
    ];

    /// <summary><c>CreatedAt</c> creciente: el catálogo se lista en el mismo orden que la semilla de la tienda.</summary>
    public static Product[] Products =>
    [
        .. Catalog.Select((row, index) => new Product
        {
            Id = IdOf(row), Line = row.Line, PieceNumber = row.Piece, Slug = row.Slug, BrandId = row.BrandId,
            ProductTypeId = row.TypeId, CollectionId = row.CollectionId, Name = row.Name, NameJp = row.NameJp,
            Material = row.Material, Price = row.Price, UnitsPerPack = row.UnitsPerPack, EditionSize = row.EditionSize,
            CreatedAt = SeededAt.AddMinutes(index), UpdatedAt = SeededAt.AddMinutes(index),
        }),
    ];

    /// <summary>
    /// Color × talla con <c>Reserved = 0</c>. El stock del producto se reparte parejo y el sobrante va a las primeras
    /// variantes, con la misma regla que <c>services/catalogService.js</c> y el panel.
    /// </summary>
    public static ProductVariant[] Variants => [.. Catalog.SelectMany(VariantsOf)];

    /// <summary>Usuario demo con su contraseña en claro, que el seeder hashea con <c>PasswordHasher&lt;User&gt;</c>.</summary>
    public sealed record DemoUser(User User, string Password);

    /// <summary>Cuentas demo de DESIGN_AUTH §4.2 y DESIGN_ADMIN §4 (§5.7). Aiko es Dueño y compradora (P-01).</summary>
    public static DemoUser[] Users =>
    [
        new(new User
        {
            FirstName = "Aiko", LastName = "Morales", Email = "hola@sokko.mx", Role = UserRole.Owner,
            PreferredSizeId = SizeIds.CalcetaM, MarketingOptIn = true,
            CreatedAt = Utc(2026, 3, 21), UpdatedAt = Utc(2026, 3, 21), AcceptedTermsAt = Utc(2026, 3, 21),
        }, "Kyoto2026"),
        new(new User { FirstName = "Daniel", LastName = "Ruiz", Email = "daniel@sokko.mx", Role = UserRole.Operations }, "Operaciones2026"),
        new(new User { FirstName = "Kevin", LastName = "Armenta", Email = "kevin@sokko.mx", Role = UserRole.Operations }, "Operaciones2026"),
        new(new User
        {
            FirstName = "Nexus", LastName = "Code", Email = "nexus@sokko.mx", Role = UserRole.Customer,
            CreatedAt = Utc(2026, 1, 15), UpdatedAt = Utc(2026, 1, 15), AcceptedTermsAt = Utc(2026, 1, 15),
        }, "NexusCode2026"),
    ];

    /// <summary>D-21: en SOKKO, <c>Id = PieceNumber</c>; las demás líneas usan su centena.</summary>
    private static int IdOf(SeedProduct row) => row.Line switch
    {
        ProductLine.Sokko => row.Piece,
        ProductLine.Marcas => 100 + row.Piece,
        ProductLine.Especiales => 200 + row.Piece,
        _ => 300 + row.Piece,
    };

    private static string SkuPrefix(ProductLine line) => line switch
    {
        ProductLine.Sokko => "SKK",
        ProductLine.Marcas => "MRC",
        ProductLine.Especiales => "ESP",
        _ => "ACC",
    };

    private static IEnumerable<ProductVariant> VariantsOf(SeedProduct row)
    {
        var system = ProductTypes.Single(t => t.Id == row.TypeId).SizeSystem;
        var sizes = Sizes.Where(s => s.SizeSystem == system).OrderBy(s => s.SortOrder).ToList();
        var count = row.Colors.Length * sizes.Count;

        for (var c = 0; c < row.Colors.Length; c++)
        {
            for (var s = 0; s < sizes.Count; s++)
            {
                var index = c * sizes.Count + s;
                yield return new ProductVariant
                {
                    ProductId = IdOf(row),
                    ColorCode = row.Colors[c],
                    SizeId = sizes[s].Id,
                    Sku = $"{SkuPrefix(row.Line)}-{row.Piece:000}-{row.Colors[c]}-{sizes[s].Code}",
                    // Solo Marcas trae código del proveedor (exampleBarcode del panel).
                    Barcode = row.Line == ProductLine.Marcas ? $"0195238{row.Piece:000}{c}{s}" : null,
                    UnitCost = row.UnitCost,
                    Stock = row.Stock / count + (index < row.Stock % count ? 1 : 0),
                };
            }
        }
    }

    private static DateTime Utc(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);
}
