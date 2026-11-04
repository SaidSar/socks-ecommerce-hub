using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

public enum WishlistAddResult
{
    Added,
    NotFound,
    LimitReached,
}

/// <summary>Servicio de entidad: único escritor de <c>WishlistItems</c>. Solo cuentan y se muestran los productos activos.</summary>
public interface IWishlistService
{
    /// <summary>Tarjetas de catálogo, del favorito más reciente al más antiguo.</summary>
    Task<IReadOnlyList<ProductDto>> ListAsync(int userId, CancellationToken cancellationToken = default);

    /// <summary>Idempotente: un producto que ya está en la lista cuenta como agregado.</summary>
    Task<WishlistAddResult> AddAsync(int userId, string slug, CancellationToken cancellationToken = default);

    /// <summary>Idempotente: quitar algo que no está no falla.</summary>
    Task RemoveAsync(int userId, string slug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Une la lista del invitado (la primera, la más reciente) y devuelve la lista final. Los productos que no existen,
    /// los inactivos y los que pasarían del límite se ignoran: iniciar sesión nunca falla por los favoritos.
    /// </summary>
    Task<IReadOnlyList<ProductDto>> MergeAsync(int userId, IReadOnlyList<string> slugs, CancellationToken cancellationToken = default);
}

public class WishlistService(SokkoDbContext db, ICatalogService catalog, IClock clock) : IWishlistService
{
    public const int MaxItems = 100;
    public const int MaxMerge = 50;
    public const string LimitMessage = "Su lista de favoritos ya tiene 100 piezas. Quite alguna para agregar otra.";

    private const int SqlUniqueConstraintViolation = 2627;

    private IQueryable<WishlistItem> ActiveItems(int userId) =>
        db.WishlistItems.AsNoTracking().Where(w => w.UserId == userId && w.Product.IsActive);

    public async Task<IReadOnlyList<ProductDto>> ListAsync(int userId, CancellationToken cancellationToken = default)
    {
        var ids = await ActiveItems(userId)
            .OrderByDescending(w => w.CreatedAt)
            .ThenByDescending(w => w.ProductId)
            .Select(w => w.ProductId)
            .ToListAsync(cancellationToken);
        return await catalog.ListByIdsAsync(ids, cancellationToken);
    }

    public async Task<WishlistAddResult> AddAsync(int userId, string slug, CancellationToken cancellationToken = default)
    {
        var productId = await db.Products
            .Where(p => p.Slug == slug && p.IsActive)
            .Select(p => (int?)p.Id)
            .FirstOrDefaultAsync(cancellationToken);
        if (productId is null)
        {
            return WishlistAddResult.NotFound;
        }
        if (await db.WishlistItems.AnyAsync(w => w.UserId == userId && w.ProductId == productId, cancellationToken))
        {
            return WishlistAddResult.Added;
        }
        if (await ActiveItems(userId).CountAsync(cancellationToken) >= MaxItems)
        {
            return WishlistAddResult.LimitReached;
        }

        var item = new WishlistItem { UserId = userId, ProductId = productId.Value, CreatedAt = clock.UtcNow };
        db.WishlistItems.Add(item);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: SqlUniqueConstraintViolation })
        {
            // Dos clics simultáneos: el otro ya lo guardó.
            db.Entry(item).State = EntityState.Detached;
        }
        return WishlistAddResult.Added;
    }

    public Task RemoveAsync(int userId, string slug, CancellationToken cancellationToken = default) =>
        db.WishlistItems
            .Where(w => w.UserId == userId && w.Product.Slug == slug)
            .ExecuteDeleteAsync(cancellationToken);

    public async Task<IReadOnlyList<ProductDto>> MergeAsync(int userId, IReadOnlyList<string> slugs, CancellationToken cancellationToken = default)
    {
        var wanted = slugs.Where(s => !string.IsNullOrWhiteSpace(s)).Distinct().Take(MaxMerge).ToList();
        if (wanted.Count > 0)
        {
            var idBySlug = await db.Products
                .AsNoTracking()
                .Where(p => wanted.Contains(p.Slug) && p.IsActive)
                .ToDictionaryAsync(p => p.Slug, p => p.Id, cancellationToken);
            var saved = await db.WishlistItems.Where(w => w.UserId == userId).Select(w => w.ProductId).ToListAsync(cancellationToken);
            var room = MaxItems - await ActiveItems(userId).CountAsync(cancellationToken);
            var toAdd = wanted
                .Where(idBySlug.ContainsKey)
                .Select(s => idBySlug[s])
                .Where(id => !saved.Contains(id))
                .Take(Math.Max(room, 0))
                .ToList();

            // Un milisegundo menos por posición conserva el orden de la lista local.
            var now = clock.UtcNow;
            db.WishlistItems.AddRange(toAdd.Select((id, i) => new WishlistItem { UserId = userId, ProductId = id, CreatedAt = now.AddMilliseconds(-i) }));
            try
            {
                await db.SaveChangesAsync(cancellationToken);
            }
            catch (DbUpdateException ex) when (ex.InnerException is SqlException { Number: SqlUniqueConstraintViolation })
            {
                // Otra pestaña unió la misma lista al mismo tiempo; lo que quedó guardado es la lista final.
                db.ChangeTracker.Clear();
            }
        }
        return await ListAsync(userId, cancellationToken);
    }
}
