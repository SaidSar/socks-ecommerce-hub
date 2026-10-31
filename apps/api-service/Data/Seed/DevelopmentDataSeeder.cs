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
        await SeedDemoOrdersAsync(db, cancellationToken);
    }

    /// <summary>
    /// Pedidos demo (P-08) con su efecto en el inventario: lo que ya salió es Venta y lo que sigue en bodega queda apartado (R-19).
    /// Cada SKU recibe antes una Entrada por esas unidades, así que su disponible sigue siendo el de la semilla y la tienda no cambia.
    /// Se salta si ya están, o si alguno de sus SKU tiene actividad real: fechas pasadas romperían el orden de su kárdex.
    /// </summary>
    private static async Task SeedDemoOrdersAsync(SokkoDbContext db, CancellationToken cancellationToken)
    {
        var seed = DemoOrdersSeed.Orders;
        var folios = seed.Select(o => o.Folio).ToList();
        if (await db.Orders.AnyAsync(o => folios.Contains(o.FolioNumber), cancellationToken))
        {
            return;
        }

        var skus = seed.SelectMany(o => o.Items).Select(i => i.Sku).Distinct().ToList();
        var variants = await db.ProductVariants
            .Include(v => v.Product)
            .Include(v => v.Color)
            .Include(v => v.Size)
            .Where(v => skus.Contains(v.Sku))
            .ToDictionaryAsync(v => v.Sku, cancellationToken);
        var variantIds = variants.Values.Select(v => v.Id).ToList();
        if (await db.InventoryMovements.AnyAsync(m => variantIds.Contains(m.VariantId) && m.CreatedByName != DevelopmentSeed.SeedActorName, cancellationToken)
            || variants.Values.Any(v => v.Reserved > 0))
        {
            Console.WriteLine("Pedidos demo omitidos: sus SKU ya tienen actividad real.");
            return;
        }

        var now = DateTime.UtcNow;
        DateTime Ago(int minutes) => now.AddMinutes(-minutes);

        var staff = await db.Users.Where(u => u.Role != UserRole.Customer).ToListAsync(cancellationToken);
        int? UserIdOfShort(string name) => staff.FirstOrDefault(u => $"{u.FirstName} {u.LastName[0]}." == name)?.Id;
        var taxRate = await db.Settings.Select(s => s.IvaRate).SingleAsync(cancellationToken);

        var orders = seed.Select(o => DemoOrderOf(o, variants, staff, UserIdOfShort, taxRate, Ago)).ToList();
        db.Orders.AddRange(orders);
        await db.SaveChangesAsync(cancellationToken);

        // El kárdex debe leerse en orden: lo de la semilla va antes que los pedidos demo.
        var seedMovementsAt = Ago(DemoOrdersSeed.SeedMovementsMinutesAgo);
        await db.InventoryMovements
            .Where(m => variantIds.Contains(m.VariantId) && m.CreatedAt > seedMovementsAt)
            .ExecuteUpdateAsync(u => u.SetProperty(m => m.CreatedAt, seedMovementsAt), cancellationToken);

        var orderIds = orders.ToDictionary(o => o.FolioNumber, o => o.Id);
        var sales = seed
            .Where(o => o.History.Any(h => h.Status is OrderStatus.Enviado or OrderStatus.EnRuta))
            .SelectMany(o =>
            {
                var step = o.History.First(h => h.Status is OrderStatus.Enviado or OrderStatus.EnRuta);
                return o.Items.Select(i => (i.Sku, i.Qty, o.Folio, step.Ago, step.By));
            })
            .ToLookup(s => s.Sku);
        var reserved = seed
            .Where(o => o.Status is OrderStatus.PorPreparar or OrderStatus.Preparando)
            .SelectMany(o => o.Items)
            .GroupBy(i => i.Sku)
            .ToDictionary(g => g.Key, g => g.Sum(i => i.Qty));

        foreach (var variant in variants.Values)
        {
            var open = reserved.GetValueOrDefault(variant.Sku);
            var entry = open + sales[variant.Sku].Sum(s => s.Qty);
            if (entry == 0)
            {
                continue;
            }

            var balance = variant.Stock + entry;
            db.InventoryMovements.Add(new InventoryMovement
            {
                VariantId = variant.Id, Type = InventoryMovementType.Entrada, Quantity = entry, Balance = balance, Note = DemoOrdersSeed.RestockNote,
                CreatedByUserId = UserIdOfShort(DemoOrdersSeed.RestockActor), CreatedByName = DemoOrdersSeed.RestockActor, CreatedAt = Ago(DemoOrdersSeed.RestockMinutesAgo),
            });
            foreach (var sale in sales[variant.Sku].OrderByDescending(s => s.Ago))
            {
                balance -= sale.Qty;
                db.InventoryMovements.Add(new InventoryMovement
                {
                    VariantId = variant.Id, Type = InventoryMovementType.Venta, Quantity = -sale.Qty, Balance = balance, Note = $"Pedido SKK-{sale.Folio}", OrderId = orderIds[sale.Folio],
                    CreatedByUserId = UserIdOfShort(sale.By), CreatedByName = sale.By, CreatedAt = Ago(sale.Ago),
                });
            }
            variant.Stock = balance;
            variant.Reserved = open;
        }
        await db.SaveChangesAsync(cancellationToken);

        // La tienda sigue en el folio siguiente (P-10); nunca se regresa una secuencia que ya pasó.
        var current = await db.Database
            .SqlQueryRaw<int>($"SELECT CAST(current_value AS int) AS [Value] FROM sys.sequences WHERE name = '{SokkoDbContext.OrderFolioSequence}'")
            .SingleAsync(cancellationToken);
        if (current < DemoOrdersSeed.NextFolio)
        {
            await db.Database.ExecuteSqlRawAsync($"ALTER SEQUENCE [dbo].[{SokkoDbContext.OrderFolioSequence}] RESTART WITH {DemoOrdersSeed.NextFolio}", cancellationToken);
        }
    }

    private static Order DemoOrderOf(
        DemoOrdersSeed.DemoOrder o, Dictionary<string, ProductVariant> variants, List<User> staff, Func<string, int?> userIdOfShort, decimal taxRate, Func<int, DateTime> ago)
    {
        var subtotal = o.Items.Sum(i => i.Qty * i.Price);
        var history = o.History.Select(h => new OrderStatusHistory
        {
            Status = h.Status, ChangedAt = ago(h.Ago), ChangedByUserId = userIdOfShort(h.By), ChangedByName = h.By,
        }).ToList();

        var shipStep = o.History.Where(h => h.Status is OrderStatus.Enviado or OrderStatus.EnRuta).Select(h => (int?)h.Ago).FirstOrDefault();
        var deliveredStep = o.History.Where(h => h.Status == OrderStatus.Entregado).Select(h => (int?)h.Ago).FirstOrDefault();
        return new Order
        {
            FolioNumber = o.Folio,
            CustomerFirstName = o.FirstName,
            CustomerLastName = o.LastName,
            CustomerEmail = o.Email,
            CustomerPhone = "6680000000",
            ShipStreet = "Calle Demo 123",
            ShipNeighborhood = "Centro",
            ShipCity = o.City,
            ShipState = o.State,
            ShipPostalCode = o.PostalCode,
            DeliveryMethod = o.Delivery,
            Status = o.Status,
            PaymentMethod = o.Payment,
            PaymentStatus = o.PaymentStatus,
            PaymentReference = $"demo_{o.Folio}",
            PaidAt = o.PaidAgo is { } paid ? ago(paid) : null,
            Subtotal = subtotal,
            ShippingCost = o.Shipping,
            Total = subtotal + o.Shipping,
            TaxRate = taxRate,
            GiftWrap = o.GiftWrap,
            InternalNote = o.Note,
            CreatedAt = ago(o.CreatedAgo),
            UpdatedAt = ago(o.History.Count == 0 ? o.CreatedAgo : o.History.Min(h => h.Ago)),
            Items = o.Items.Select(i =>
            {
                var variant = variants[i.Sku];
                return new OrderItem
                {
                    VariantId = variant.Id, SkuSnapshot = i.Sku, ProductNameSnapshot = variant.Product.Name, ToneNameSnapshot = variant.Color.Name, SizeCodeSnapshot = variant.Size.Code,
                    Quantity = i.Qty, UnitPrice = i.Price,
                };
            }).ToList(),
            StatusHistory = history,
            Shipment = shipStep is { } shipped
                ? new Shipment
                {
                    DeliveryMethod = o.Delivery,
                    Carrier = o.Carrier,
                    TrackingNumber = o.Tracking,
                    CourierUserId = staff.FirstOrDefault(u => $"{u.FirstName} {u.LastName}" == o.Courier)?.Id,
                    CourierName = o.Courier,
                    ShippedAt = ago(shipped),
                    DeliveredAt = deliveredStep is { } delivered ? ago(delivered) : null,
                }
                : null,
        };
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
