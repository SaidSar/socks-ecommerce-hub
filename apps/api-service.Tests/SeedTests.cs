using System.Text.RegularExpressions;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Tests;

/// <summary>La semilla de DESIGN_DB §5 cumple sus totales y las reglas que la BD no puede revisar (R-06, R-32).</summary>
public partial class SeedTests
{
    private static readonly Dictionary<ProductLine, string> SkuPrefix = new()
    {
        [ProductLine.Sokko] = "SKK",
        [ProductLine.Marcas] = "MRC",
        [ProductLine.Especiales] = "ESP",
        [ProductLine.Accesorios] = "ACC",
    };

    [GeneratedRegex("^[A-Z]{3}-[0-9]{3}-[A-Z]{3}-[A-Z0-9]{1,3}$")]
    private static partial Regex SkuFormat();

    [GeneratedRegex(@"slug: '(?<slug>[a-z0-9-]+)'.*?price: (?<price>\d+).*?stock: (?<stock>\d+)")]
    private static partial Regex StoreProduct();

    [Fact]
    public void Catalog_seed_has_the_documented_rows()
    {
        Assert.Equal(14, CatalogSeed.Colors.Length);
        Assert.Equal(4, CatalogSeed.Colors.Count(c => c.IsSokkoTone));
        Assert.All(CatalogSeed.Colors, c => Assert.Matches("^#[0-9A-F]{6}$", c.Hex!));
        Assert.Equal(7, CatalogSeed.Sizes.Length);
        Assert.Equal(7, CatalogSeed.Brands.Length);
        Assert.Single(CatalogSeed.Brands, b => b.IsOwnBrand);
        Assert.Equal(7, CatalogSeed.ProductTypes.Length);
        Assert.Equal(4, CatalogSeed.Collections.Length);
        Assert.Equal(2, CatalogSeed.LocalDeliveryZones.Length);
    }

    [Fact]
    public void Development_seed_matches_the_store_catalog_seed()
    {
        var source = File.ReadAllText(FindStoreSeed());
        var products = source[source.IndexOf("export const PRODUCTS", StringComparison.Ordinal)..];
        var store = StoreProduct().Matches(products)
            .Select(m => (Slug: m.Groups["slug"].Value, Price: int.Parse(m.Groups["price"].Value), Stock: int.Parse(m.Groups["stock"].Value)))
            .ToList();
        var variants = DevelopmentSeed.Variants;

        Assert.Equal(store.Select(p => p.Slug), DevelopmentSeed.Products.Select(p => p.Slug));
        Assert.All(store, p =>
        {
            var seed = DevelopmentSeed.Products.Single(x => x.Slug == p.Slug);
            Assert.Equal(p.Price, seed.Price);
            Assert.Equal(p.Stock, variants.Where(v => v.ProductId == seed.Id).Sum(v => v.Stock));
        });
    }

    private static string FindStoreSeed()
    {
        for (var dir = new DirectoryInfo(AppContext.BaseDirectory); dir is not null; dir = dir.Parent)
        {
            var path = Path.Combine(dir.FullName, "apps", "web-store", "src", "data", "catalogSeed.js");
            if (File.Exists(path))
            {
                return path;
            }
        }
        throw new FileNotFoundException("No se encontró apps/web-store/src/data/catalogSeed.js.");
    }

    [Fact]
    public void Variant_stock_is_split_evenly_with_the_remainder_first()
    {
        var kintsugi = DevelopmentSeed.Variants.Where(v => v.ProductId == 3).ToList();

        Assert.Equal(["SKK-003-WAS-S", "SKK-003-WAS-M", "SKK-003-WAS-L"], kintsugi.Where(v => v.Stock > 0).Select(v => v.Sku));
        Assert.Equal(6, kintsugi.Count(v => v.Stock == 0));
    }

    [Fact]
    public void Costs_and_barcodes_match_the_admin_panel()
    {
        var variants = DevelopmentSeed.Variants;

        Assert.Equal(168m, variants.First(v => v.Sku == "SKK-007-SUM-S").UnitCost);
        Assert.Null(variants.First(v => v.Sku == "SKK-015-MAT-S").UnitCost);
        Assert.Equal("019523800111", variants.First(v => v.Sku == "MRC-001-NEG-M").Barcode);
        Assert.All(variants.Where(v => !v.Sku.StartsWith("MRC-")), v => Assert.Null(v.Barcode));
    }

    [Fact]
    public void Development_seed_matches_the_documented_totals()
    {
        var products = DevelopmentSeed.Products;
        var variants = DevelopmentSeed.Variants;
        var lineOf = products.ToDictionary(p => p.Id, p => p.Line);

        Assert.Equal(24, products.Length);
        Assert.Equal(120, variants.Length);
        Assert.Equal(336, variants.Sum(v => v.Stock));
        Assert.Equal(111, variants.Where(v => lineOf[v.ProductId] == ProductLine.Sokko).Sum(v => v.Stock));
        // Un movimiento InventarioInicial por SKU con stock: 11 SKU nacen agotados.
        Assert.Equal(109, variants.Count(v => v.Stock > 0));
        Assert.All(variants, v => Assert.Equal(0, v.Reserved));
    }

    [Fact]
    public void Skus_are_unique_and_match_line_piece_color_and_size()
    {
        var products = DevelopmentSeed.Products.ToDictionary(p => p.Id);
        var sizes = CatalogSeed.Sizes.ToDictionary(s => s.Id);
        var variants = DevelopmentSeed.Variants;

        Assert.Equal(variants.Length, variants.Select(v => v.Sku).Distinct().Count());
        Assert.All(variants, v =>
        {
            var product = products[v.ProductId];
            Assert.Matches(SkuFormat(), v.Sku);
            Assert.Equal($"{SkuPrefix[product.Line]}-{product.PieceNumber:000}-{v.ColorCode}-{sizes[v.SizeId].Code}", v.Sku);
        });
    }

    [Fact]
    public void Variant_sizes_belong_to_the_size_system_of_the_product_type()
    {
        // R-32: la BD no lo puede revisar con un CHECK.
        var products = DevelopmentSeed.Products.ToDictionary(p => p.Id);
        var types = CatalogSeed.ProductTypes.ToDictionary(t => t.Id);
        var sizes = CatalogSeed.Sizes.ToDictionary(s => s.Id);

        Assert.All(DevelopmentSeed.Variants, v =>
            Assert.Equal(types[products[v.ProductId].ProductTypeId].SizeSystem, sizes[v.SizeId].SizeSystem));
    }

    [Fact]
    public void Kyoto_tones_and_own_brand_are_exclusive_to_the_sokko_line()
    {
        // R-32.
        var products = DevelopmentSeed.Products.ToDictionary(p => p.Id);
        var colors = CatalogSeed.Colors.ToDictionary(c => c.Code);
        var ownBrand = CatalogSeed.Brands.Single(b => b.IsOwnBrand).Id;

        Assert.All(products.Values, p => Assert.Equal(p.Line == ProductLine.Sokko, p.BrandId == ownBrand));
        Assert.All(DevelopmentSeed.Variants, v =>
            Assert.Equal(products[v.ProductId].Line == ProductLine.Sokko, colors[v.ColorCode].IsSokkoTone));
    }

    [Fact]
    public void Sokko_products_keep_id_equal_to_piece_number()
    {
        // D-21: coinciden con los ids del mock de la tienda y del panel.
        Assert.All(DevelopmentSeed.Products.Where(p => p.Line == ProductLine.Sokko), p => Assert.Equal(p.Id, p.PieceNumber));
        Assert.Contains(DevelopmentSeed.Products, p => p.Id == DevelopmentSeed.FeaturedProductId && p.Line == ProductLine.Sokko);
    }

    [Fact]
    public void Demo_users_have_unique_lowercase_emails_and_customers_accept_terms()
    {
        var users = DevelopmentSeed.Users.Select(d => d.User).ToList();

        Assert.Equal(users.Count, users.Select(u => u.Email).Distinct().Count());
        Assert.All(users, u => Assert.Equal(u.Email.Trim().ToLowerInvariant(), u.Email));
        Assert.All(users.Where(u => u.Role == UserRole.Customer), u => Assert.NotNull(u.AcceptedTermsAt));
    }
}
