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

    [Fact]
    public void Catalog_seed_has_the_documented_rows()
    {
        Assert.Equal(8, CatalogSeed.Colors.Length);
        Assert.Equal(4, CatalogSeed.Colors.Count(c => c.IsSokkoTone));
        Assert.Equal(7, CatalogSeed.Sizes.Length);
        Assert.Equal(6, CatalogSeed.Brands.Length);
        Assert.Single(CatalogSeed.Brands, b => b.IsOwnBrand);
        Assert.Equal(7, CatalogSeed.ProductTypes.Length);
        Assert.Equal(3, CatalogSeed.Collections.Length);
        Assert.Equal(2, CatalogSeed.LocalDeliveryZones.Length);
    }

    [Fact]
    public void Development_seed_matches_the_documented_totals()
    {
        var products = DevelopmentSeed.Products;
        var variants = DevelopmentSeed.Variants;
        var lineOf = products.ToDictionary(p => p.Id, p => p.Line);

        Assert.Equal(14, products.Length);
        Assert.Equal(64, variants.Length);
        Assert.Equal(256, variants.Sum(v => v.Stock));
        Assert.Equal(124, variants.Where(v => lineOf[v.ProductId] == ProductLine.Sokko).Sum(v => v.Stock));
        // Un movimiento InventarioInicial por SKU con stock: SKK-003-WAS-S nace en 0.
        Assert.Equal(63, variants.Count(v => v.Stock > 0));
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
