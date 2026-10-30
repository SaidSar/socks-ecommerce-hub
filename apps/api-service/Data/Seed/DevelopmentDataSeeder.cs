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
        if (await db.Products.AnyAsync(cancellationToken))
        {
            return;
        }

        // Ids fijos (Id = PieceNumber en SOKKO, D-21): requieren IDENTITY_INSERT en la misma conexión.
        await db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Products] ON", cancellationToken);
        db.Products.AddRange(DevelopmentSeed.Products);
        await db.SaveChangesAsync(cancellationToken);
        await db.Database.ExecuteSqlRawAsync("SET IDENTITY_INSERT [dbo].[Products] OFF", cancellationToken);

        var variants = DevelopmentSeed.Variants;
        db.ProductVariants.AddRange(variants);
        await db.SaveChangesAsync(cancellationToken);

        // Un InventarioInicial por SKU con stock, para que el último saldo del kárdex sea igual al stock (R-19).
        db.InventoryMovements.AddRange(variants
            .Where(v => v.Stock > 0)
            .Select(v => new InventoryMovement
            {
                VariantId = v.Id,
                Type = InventoryMovementType.InventarioInicial,
                Quantity = v.Stock,
                Balance = v.Stock,
                Note = DevelopmentSeed.InitialInventoryNote,
                CreatedByName = DevelopmentSeed.SeedActorName,
            }));

        var settings = await db.Settings.SingleAsync(cancellationToken);
        settings.FeaturedProductId ??= DevelopmentSeed.FeaturedProductId;
        await db.SaveChangesAsync(cancellationToken);
    }
}
