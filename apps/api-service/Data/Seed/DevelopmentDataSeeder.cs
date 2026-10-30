using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Data.Seed;

/// <summary>
/// Siembra <see cref="DevelopmentSeed"/> al aplicar migraciones en Development (<c>UseSeeding</c> de EF Core).
/// Es idempotente: cada bloque se salta si ya existe, así que correr <c>dotnet ef database update</c> otra vez no duplica nada.
/// </summary>
public static class DevelopmentDataSeeder
{
    public static void Seed(DbContext context) => SeedAsync(context, CancellationToken.None).GetAwaiter().GetResult();

    public static async Task SeedAsync(DbContext context, CancellationToken cancellationToken)
    {
        var db = (SokkoDbContext)context;
        // Sin migraciones pendientes, EF llama al seeding dentro de su propia transacción: se reutiliza.
        if (db.Database.CurrentTransaction is not null)
        {
            await SeedAllAsync(db, cancellationToken);
        }
        else
        {
            // Con EnableRetryOnFailure, una transacción explícita tiene que ir dentro de la estrategia de ejecución.
            await db.Database.CreateExecutionStrategy().ExecuteAsync(async () =>
            {
                await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                await SeedAllAsync(db, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });
        }
        db.ChangeTracker.Clear();
    }

    private static async Task SeedAllAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        await SeedUsersAsync(db, cancellationToken);
        await SeedCatalogAsync(db, cancellationToken);
    }

    private static async Task SeedUsersAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        var existing = await db.Users.Select(u => u.Email).ToListAsync(cancellationToken);
        var hasher = new PasswordHasher<User>();
        foreach (var (user, password) in DevelopmentSeed.Users.Where(d => !existing.Contains(d.User.Email)))
        {
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Users.Add(user);
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task SeedCatalogAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        await RemoveRetiredProductsAsync(db, cancellationToken);
        await AddMissingProductsAsync(db, cancellationToken);
        await AlignVariantsAsync(db, cancellationToken);

        var settings = await db.Settings.SingleAsync(cancellationToken);
        settings.FeaturedProductId ??= DevelopmentSeed.FeaturedProductId;
        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Quita los productos de la semilla anterior, que ocupan piezas y SKU de los nuevos. Nunca toca datos con actividad real.</summary>
    private static async Task RemoveRetiredProductsAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        var retired = await db.Products
            .Where(p => DevelopmentSeed.RetiredSlugs.Contains(p.Slug))
            .Include(p => p.Variants).ThenInclude(v => v.Movements)
            .ToListAsync(cancellationToken);
        if (retired.Count == 0)
        {
            return;
        }

        var variants = retired.SelectMany(p => p.Variants).ToList();
        var variantIds = variants.Select(v => v.Id).ToList();
        var hasActivity = variants.Any(v => !IsSeedOnly(v))
            || await db.OrderItems.AnyAsync(i => variantIds.Contains(i.VariantId), cancellationToken);
        if (hasActivity)
        {
            throw new InvalidOperationException(
                "Hay productos de la semilla anterior con pedidos o movimientos reales: revíselos antes de alinear la semilla.");
        }

        db.InventoryMovements.RemoveRange(variants.SelectMany(v => v.Movements));
        db.ProductVariants.RemoveRange(variants);
        db.Products.RemoveRange(retired);
        await db.SaveChangesAsync(cancellationToken);
    }

    private static async Task AddMissingProductsAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        var existing = await db.Products.ToDictionaryAsync(p => p.Slug, cancellationToken);
        var seed = DevelopmentSeed.Products;

        // El orden del catálogo sale de CreatedAt: los que ya existían toman el de la semilla.
        foreach (var product in seed.Where(p => existing.ContainsKey(p.Slug)))
        {
            existing[product.Slug].CreatedAt = product.CreatedAt;
        }
        await db.SaveChangesAsync(cancellationToken);

        var missing = seed.Where(p => !existing.ContainsKey(p.Slug)).ToList();
        if (missing.Count == 0)
        {
            return;
        }

        // Ids fijos (Id = PieceNumber en SOKKO, D-21): requieren IDENTITY_INSERT en la misma conexión.
        await db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Products] ON", cancellationToken);
        db.Products.AddRange(missing);
        await db.SaveChangesAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Products] OFF", cancellationToken);
    }

    /// <summary>
    /// Crea los SKU que falten con su InventarioInicial (R-19) y alinea los que solo tienen movimientos de la semilla.
    /// El kárdex es de solo inserción (D-12): un cambio de stock se registra como ConteoFisico.
    /// </summary>
    private static async Task AlignVariantsAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        var existing = await db.ProductVariants
            .Include(v => v.Movements)
            .ToDictionaryAsync(v => v.Sku, cancellationToken);
        var seed = DevelopmentSeed.Variants;

        var missing = seed.Where(v => !existing.ContainsKey(v.Sku)).ToList();
        db.ProductVariants.AddRange(missing);
        await db.SaveChangesAsync(cancellationToken);

        db.InventoryMovements.AddRange(missing
            .Where(v => v.Stock > 0)
            .Select(v => SeedMovement(v, InventoryMovementType.InventarioInicial, v.Stock, DevelopmentSeed.InitialInventoryNote)));

        foreach (var target in seed.Where(v => existing.ContainsKey(v.Sku)))
        {
            var variant = existing[target.Sku];
            if (!IsSeedOnly(variant))
            {
                continue;
            }

            variant.UnitCost = target.UnitCost;
            variant.Barcode = target.Barcode;
            if (variant.Stock != target.Stock)
            {
                db.InventoryMovements.Add(SeedMovement(target, InventoryMovementType.ConteoFisico, target.Stock - variant.Stock, DevelopmentSeed.AlignmentNote, variant.Id));
                variant.Stock = target.Stock;
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }

    private static bool IsSeedOnly(ProductVariant variant) =>
        variant.Reserved == 0 && variant.Movements.All(m => m.CreatedByName == DevelopmentSeed.SeedActorName);

    private static InventoryMovement SeedMovement(ProductVariant target, InventoryMovementType type, int quantity, string note, int? variantId = null) => new()
    {
        VariantId = variantId ?? target.Id,
        Type = type,
        Quantity = quantity,
        Balance = target.Stock,
        Note = note,
        CreatedByName = DevelopmentSeed.SeedActorName,
    };
}
