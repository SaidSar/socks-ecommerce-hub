using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using static Sokko.Api.Data.Seed.CatalogSeed;

namespace Sokko.Api.Data.Seed;

/// <summary>
/// Datos de ejemplo solo para Development (DESIGN_DB §5.4, §5.4a y §5.7): 14 productos, 64 SKU con su stock inicial y
/// los usuarios demo. Los aplica <see cref="DevelopmentDataSeeder"/>; nunca van en la migración.
/// </summary>
public static class DevelopmentSeed
{
    public const string SeedActorName = "Semilla";
    public const string InitialInventoryNote = "Inventario inicial de semilla";

    /// <summary>Pieza del hero (<c>Settings.FeaturedProductId</c>): Tabi Origami Noche.</summary>
    public const int FeaturedProductId = 7;

    /// <summary>Los 6 de SOKKO con <c>Id = PieceNumber</c> (D-21) y 8 de ejemplo de las otras líneas.</summary>
    public static Product[] Products =>
    [
        Sokko(7, "tabi-origami-noche", "Tabi Origami Noche", "折紙・夜", "Algodón peinado D-200 · pliegue en empeine", 420.00m, editionSize: 120),
        Sokko(12, "lino-komorebi", "Lino Komorebi", "木漏れ日", "Lino y algodón · tinte de té verde", 380.00m),
        Sokko(3, "kintsugi-washi", "Kintsugi Washi", "金継ぎ", "Algodón peinado · costura dorada visible", 460.00m, editionSize: 80),
        Sokko(21, "hanami-laca", "Hanami Laca", "花見", "Algodón peinado · pigmento mineral rojo", 395.00m),
        Sokko(15, "tsuchi-raiz", "Tsuchi Raíz", "土", "Algodón y bambú · teñido con tierra ocre", 360.00m),
        Sokko(9, "mizu-calma", "Mizu Calma", "水", "Algodón peinado · punto tubular sin costura", 340.00m),

        Other(101, ProductLine.Marcas, 1, "nike-everyday-paquete-3", "Nike Everyday · paquete de 3 pares", BrandIds.Nike,
            ProductTypeIds.Calcetas, null, "Algodón con amortiguación en planta", 449.00m, unitsPerPack: 3),
        Other(102, ProductLine.Marcas, 2, "puma-deportiva-tobillera", "Puma Deportiva tobillera", BrandIds.Puma,
            ProductTypeIds.Calcetas, null, "Algodón y poliéster · tobillera deportiva", 189.00m),
        Other(201, ProductLine.Especiales, 1, "calceta-navidena-copo", "Calceta navideña Copo", BrandIds.SinMarca,
            ProductTypeIds.Calcetas, CollectionIds.Navidad, "Tejido jacquard de invierno", 199.00m),
        Other(202, ProductLine.Especiales, 2, "calceta-calabaza", "Calceta Calabaza", BrandIds.SinMarca,
            ProductTypeIds.Calcetas, CollectionIds.Halloween, "Algodón con estampado nocturno", 179.00m),
        Other(203, ProductLine.Especiales, 3, "calceta-pokemon-pikachu", "Calceta Pokémon Pikachu (licencia oficial)", BrandIds.Pokemon,
            ProductTypeIds.Calcetas, CollectionIds.Anime, "Algodón · licencia oficial Pokémon", 229.00m),
        Other(301, ProductLine.Accesorios, 1, "gorro-tejido", "Gorro tejido", BrandIds.SinMarca,
            ProductTypeIds.Gorros, null, "Acrílico · punto acanalado doble", 249.00m),
        Other(302, ProductLine.Accesorios, 2, "guantes-termicos", "Guantes térmicos", BrandIds.SinMarca,
            ProductTypeIds.Guantes, null, "Acrílico con forro térmico", 279.00m),
        Other(303, ProductLine.Accesorios, 3, "lentes-de-sol", "Lentes de sol", BrandIds.SinMarca,
            ProductTypeIds.Lentes, null, "Policarbonato · filtro UV400", 299.00m),
    ];

    /// <summary>
    /// Stock por tono del mock repartido en S/M/L (§5.4a, P-07): 42 SKU y 124 pares.
    /// </summary>
    private static readonly (int Piece, string Color, int S, int M, int L)[] SokkoStock =
    [
        (7, "SUM", 1, 1, 1), (7, "WAS", 4, 4, 4),
        (12, "MAT", 3, 3, 3), (12, "WAS", 1, 2, 1),
        (3, "WAS", 0, 1, 1), (3, "SUM", 2, 3, 3), (3, "LAC", 2, 2, 2),
        (21, "LAC", 3, 4, 4), (21, "WAS", 5, 5, 5),
        (15, "MAT", 4, 5, 5), (15, "SUM", 1, 1, 1),
        (9, "WAS", 6, 7, 7), (9, "MAT", 2, 3, 2), (9, "SUM", 3, 4, 3),
    ];

    /// <summary>Ejemplos de Marcas, Especiales y Accesorios (§5.4a): 22 SKU y 132 unidades; costo de ejemplo.</summary>
    private static readonly (string Sku, int ProductId, string Color, int SizeId, int Stock, decimal UnitCost)[] OtherStock =
    [
        ("MRC-001-NEG-M", 101, "NEG", SizeIds.CalcetaM, 6, 290.00m),
        ("MRC-001-NEG-L", 101, "NEG", SizeIds.CalcetaL, 6, 290.00m),
        ("MRC-001-BLA-M", 101, "BLA", SizeIds.CalcetaM, 4, 290.00m),
        ("MRC-001-BLA-L", 101, "BLA", SizeIds.CalcetaL, 4, 290.00m),
        ("MRC-002-NEG-S", 102, "NEG", SizeIds.CalcetaS, 5, 110.00m),
        ("MRC-002-NEG-M", 102, "NEG", SizeIds.CalcetaM, 8, 110.00m),
        ("MRC-002-NEG-L", 102, "NEG", SizeIds.CalcetaL, 7, 110.00m),
        ("ESP-001-MUL-S", 201, "MUL", SizeIds.CalcetaS, 6, 95.00m),
        ("ESP-001-MUL-M", 201, "MUL", SizeIds.CalcetaM, 8, 95.00m),
        ("ESP-001-MUL-L", 201, "MUL", SizeIds.CalcetaL, 6, 95.00m),
        ("ESP-002-MUL-S", 202, "MUL", SizeIds.CalcetaS, 4, 90.00m),
        ("ESP-002-MUL-M", 202, "MUL", SizeIds.CalcetaM, 6, 90.00m),
        ("ESP-002-MUL-L", 202, "MUL", SizeIds.CalcetaL, 5, 90.00m),
        ("ESP-003-MUL-S", 203, "MUL", SizeIds.CalcetaS, 3, 120.00m),
        ("ESP-003-MUL-M", 203, "MUL", SizeIds.CalcetaM, 5, 120.00m),
        ("ESP-003-MUL-L", 203, "MUL", SizeIds.CalcetaL, 4, 120.00m),
        ("ACC-001-NEG-U", 301, "NEG", SizeIds.Unitalla, 10, 120.00m),
        ("ACC-001-GRI-U", 301, "GRI", SizeIds.Unitalla, 8, 120.00m),
        ("ACC-002-NEG-S", 302, "NEG", SizeIds.GuanteS, 4, 140.00m),
        ("ACC-002-NEG-M", 302, "NEG", SizeIds.GuanteM, 6, 140.00m),
        ("ACC-002-NEG-L", 302, "NEG", SizeIds.GuanteL, 5, 140.00m),
        ("ACC-003-NEG-U", 303, "NEG", SizeIds.Unitalla, 12, 130.00m),
    ];

    /// <summary>Los 64 SKU con <c>Reserved = 0</c> y <c>Barcode = NULL</c>. SOKKO sin costo capturado (C-03).</summary>
    public static ProductVariant[] Variants =>
    [
        .. SokkoStock.SelectMany(row => new[]
        {
            SokkoVariant(row.Piece, row.Color, "S", SizeIds.CalcetaS, row.S),
            SokkoVariant(row.Piece, row.Color, "M", SizeIds.CalcetaM, row.M),
            SokkoVariant(row.Piece, row.Color, "L", SizeIds.CalcetaL, row.L),
        }),
        .. OtherStock.Select(row => new ProductVariant
        {
            ProductId = row.ProductId, ColorCode = row.Color, SizeId = row.SizeId, Sku = row.Sku,
            Stock = row.Stock, UnitCost = row.UnitCost,
        }),
    ];

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

    private static Product Sokko(int piece, string slug, string name, string nameJp, string material, decimal price, int? editionSize = null) =>
        new()
        {
            Id = piece, Line = ProductLine.Sokko, PieceNumber = (short)piece, Slug = slug, BrandId = BrandIds.Sokko,
            ProductTypeId = ProductTypeIds.Calcetas, Name = name, NameJp = nameJp, Material = material, Price = price,
            EditionSize = editionSize,
        };

    private static Product Other(int id, ProductLine line, short piece, string slug, string name, int brandId, int typeId,
        int? collectionId, string material, decimal price, byte unitsPerPack = 1) =>
        new()
        {
            Id = id, Line = line, PieceNumber = piece, Slug = slug, BrandId = brandId, ProductTypeId = typeId,
            CollectionId = collectionId, Name = name, Material = material, Price = price, UnitsPerPack = unitsPerPack,
        };

    private static ProductVariant SokkoVariant(int piece, string color, string sizeCode, int sizeId, int stock) =>
        new() { ProductId = piece, ColorCode = color, SizeId = sizeId, Sku = $"SKK-{piece:000}-{color}-{sizeCode}", Stock = stock };

    private static DateTime Utc(int year, int month, int day) => new(year, month, day, 0, 0, 0, DateTimeKind.Utc);
}
