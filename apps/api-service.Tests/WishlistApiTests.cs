using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Favoritos contra la BD real, con cuentas y productos desechables.</summary>
public class WishlistApiTests(AuthApiFactory factory) : IClassFixture<AuthApiFactory>, IAsyncLifetime
{
    private readonly HttpClient _client = factory.CreateClient();
    private readonly List<string> _emails = [];
    private readonly List<int> _productIds = [];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public ValueTask InitializeAsync() => ValueTask.CompletedTask;

    /// <summary>Al borrar las cuentas, la cascada se lleva sus favoritos; después ya se pueden borrar los productos.</summary>
    public async ValueTask DisposeAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        await db.Users.Where(u => _emails.Contains(u.Email)).ExecuteDeleteAsync();
        await db.WishlistItems.Where(w => _productIds.Contains(w.ProductId)).ExecuteDeleteAsync();
        await db.Products.Where(p => _productIds.Contains(p.Id)).ExecuteDeleteAsync();
        GC.SuppressFinalize(this);
    }

    private static async Task<JsonElement> Json(HttpResponseMessage response) =>
        await response.Content.ReadFromJsonAsync<JsonElement>(Ct);

    private async Task<HttpResponseMessage> Send(HttpMethod method, string url, string? token, object? body = null)
    {
        using var request = new HttpRequestMessage(method, url);
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
        return await _client.SendAsync(request, Ct);
    }

    private async Task<string> NewCustomer()
    {
        var email = $"favoritos-{Guid.NewGuid():N}@sokko.test";
        _emails.Add(email);
        var response = await _client.PostAsJsonAsync("/api/auth/register", new
        {
            firstName = "Ana", lastName = "Prueba", email, password = "Clave2026", marketingOptIn = false, acceptedTerms = true,
        }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("accessToken").GetString()!;
    }

    private async Task<List<string>> SeedSlugs(int count)
    {
        var page = await Json(await _client.GetAsync("/api/products?line=sokko&pageSize=48", Ct));
        var slugs = page.GetProperty("items").EnumerateArray().Select(p => p.GetProperty("slug").GetString()!).Take(count).ToList();
        Assert.Equal(count, slugs.Count);
        return slugs;
    }

    private async Task<List<string>> ListSlugs(string token)
    {
        var response = await Send(HttpMethod.Get, "/api/wishlist", token);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await Json(response)).EnumerateArray().Select(p => p.GetProperty("slug").GetString()!).ToList();
    }

    /// <summary>Accesorios desechables en números de pieza libres.</summary>
    private async Task<List<Product>> CreateProducts(int count, bool active = true)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
        var used = await db.Products.Where(p => p.Line == ProductLine.Accesorios).Select(p => p.PieceNumber).ToListAsync(Ct);
        var pieces = Enumerable.Range(1, 999).Select(n => (short)n).Except(used).Take(count).ToList();
        var products = pieces.Select(piece => new Product
        {
            Line = ProductLine.Accesorios,
            PieceNumber = piece,
            Slug = $"favorito-{Guid.NewGuid():N}",
            BrandId = CatalogSeed.BrandIds.SinMarca,
            ProductTypeId = CatalogSeed.ProductTypeIds.Lentes,
            Name = "Producto de prueba",
            Material = "Prueba",
            Price = 100m,
            IsActive = active,
        }).ToList();
        db.Products.AddRange(products);
        await db.SaveChangesAsync(Ct);
        _productIds.AddRange(products.Select(p => p.Id));
        return products;
    }

    [Fact]
    public async Task Wishlist_requires_a_bearer()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Get, "/api/wishlist", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Put, "/api/wishlist/cualquiera", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await Send(HttpMethod.Post, "/api/wishlist/merge", null, new { slugs = Array.Empty<string>() })).StatusCode);
    }

    [Fact]
    public async Task Add_is_idempotent_and_the_list_uses_the_catalog_card_most_recent_first()
    {
        var token = await NewCustomer();
        var (first, second) = (await SeedSlugs(2)) switch { var s => (s[0], s[1]) };

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/wishlist/{first}", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/wishlist/{second}", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/wishlist/{first}", token)).StatusCode);

        var list = await Json(await Send(HttpMethod.Get, "/api/wishlist", token));
        Assert.Equal([second, first], list.EnumerateArray().Select(p => p.GetProperty("slug").GetString()));
        // Misma forma que GET /api/products: la tienda la pinta con ProductCard.
        var card = list[0];
        Assert.True(card.TryGetProperty("finalPrice", out _));
        Assert.True(card.GetProperty("variants").GetArrayLength() > 0);
        Assert.False(card.TryGetProperty("sizes", out _));
    }

    [Fact]
    public async Task Remove_is_idempotent()
    {
        var token = await NewCustomer();
        var slug = (await SeedSlugs(1))[0];
        await Send(HttpMethod.Put, $"/api/wishlist/{slug}", token);

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/wishlist/{slug}", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/wishlist/{slug}", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, "/api/wishlist/no-existe", token)).StatusCode);
        Assert.Empty(await ListSlugs(token));
    }

    [Fact]
    public async Task Unknown_or_inactive_products_return_404_and_a_deactivated_one_leaves_the_list()
    {
        var token = await NewCustomer();
        var inactive = (await CreateProducts(1, active: false))[0];
        var active = (await CreateProducts(1))[0];

        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Put, "/api/wishlist/no-existe", token)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Send(HttpMethod.Put, $"/api/wishlist/{inactive.Slug}", token)).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/wishlist/{active.Slug}", token)).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            await db.Products.Where(p => p.Id == active.Id).ExecuteUpdateAsync(u => u.SetProperty(p => p.IsActive, false), Ct);
        }
        Assert.Empty(await ListSlugs(token));
    }

    [Fact]
    public async Task Merge_adds_the_guest_list_keeps_its_order_and_ignores_unknown_slugs()
    {
        var token = await NewCustomer();
        var slugs = await SeedSlugs(3);
        await Send(HttpMethod.Put, $"/api/wishlist/{slugs[0]}", token);

        var response = await Send(HttpMethod.Post, "/api/wishlist/merge", token, new { slugs = new[] { slugs[1], slugs[0], "no-existe", slugs[2], slugs[1] } });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var merged = (await Json(response)).EnumerateArray().Select(p => p.GetProperty("slug").GetString()!).ToList();
        Assert.Equal([slugs[1], slugs[2], slugs[0]], merged);
        Assert.Equal(merged, await ListSlugs(token));
    }

    [Fact]
    public async Task Merge_accepts_at_most_50_slugs()
    {
        var token = await NewCustomer();

        var response = await Send(HttpMethod.Post, "/api/wishlist/merge", token, new { slugs = Enumerable.Range(0, 51).Select(i => $"pieza-{i}") });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("errors").TryGetProperty("Slugs", out _));
    }

    [Fact]
    public async Task The_101st_favorite_returns_409_and_merge_stops_at_100()
    {
        var token = await NewCustomer();
        var products = await CreateProducts(WishlistService.MaxItems);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();
            var email = _emails[^1];
            var userId = await db.Users.Where(u => u.Email == email).Select(u => u.Id).SingleAsync(Ct);
            db.WishlistItems.AddRange(products.Select(p => new WishlistItem { UserId = userId, ProductId = p.Id, CreatedAt = DateTime.UtcNow }));
            await db.SaveChangesAsync(Ct);
        }
        var extra = (await SeedSlugs(1))[0];

        var response = await Send(HttpMethod.Put, $"/api/wishlist/{extra}", token);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(WishlistService.LimitMessage, (await Json(response)).GetProperty("title").GetString());
        // Uno que ya está sigue siendo 204: agregar es idempotente.
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Put, $"/api/wishlist/{products[0].Slug}", token)).StatusCode);

        var merged = await Send(HttpMethod.Post, "/api/wishlist/merge", token, new { slugs = new[] { extra } });
        Assert.Equal(HttpStatusCode.OK, merged.StatusCode);
        var list = (await Json(merged)).EnumerateArray().Select(p => p.GetProperty("slug").GetString()).ToList();
        Assert.Equal(WishlistService.MaxItems, list.Count);
        Assert.DoesNotContain(extra, list);
    }

    [Fact]
    public async Task A_customer_never_sees_or_changes_another_customers_list()
    {
        var ana = await NewCustomer();
        var luis = await NewCustomer();
        var slug = (await SeedSlugs(1))[0];
        await Send(HttpMethod.Put, $"/api/wishlist/{slug}", ana);

        Assert.Empty(await ListSlugs(luis));
        Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, $"/api/wishlist/{slug}", luis)).StatusCode);
        Assert.Equal([slug], await ListSlugs(ana));
    }
}
