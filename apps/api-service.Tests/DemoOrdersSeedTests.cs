using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Sokko.Api.Data;
using Sokko.Api.Data.Seed;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

public class DemoOrdersSeedTests(AdminApiFactory factory) : AdminApiTestBase(factory), IClassFixture<AdminApiFactory>
{
    private static readonly DemoOrdersSeed.DemoOrder[] Orders = DemoOrdersSeed.Orders;

    [Fact]
    public void Table_has_the_34_orders_of_the_panel()
    {
        Assert.Equal(Enumerable.Range(1027, 34), Orders.Select(o => o.Folio).Order());
        var skus = DevelopmentSeed.Variants.Select(v => v.Sku).ToHashSet();
        Assert.All(Orders.SelectMany(o => o.Items), i => Assert.Contains(i.Sku, skus));
        Assert.Contains(Orders, o => o.Delivery == DeliveryMethod.Local);
        Assert.Contains(Orders, o => o.Payment == PaymentMethod.OxxoPay && o.PaymentStatus == PaymentStatus.Pendiente);
        Assert.Contains(Orders, o => o.CreatedAgo > OrderAdminService.LateAfter.TotalMinutes && o.Status is OrderStatus.PorPreparar or OrderStatus.Preparando);
    }

    [Fact]
    public void Table_respects_the_rules_of_the_database()
    {
        foreach (var o in Orders)
        {
            Assert.False(o.Status == OrderStatus.Enviado && o.Delivery == DeliveryMethod.Local, $"{o.Folio}: CK_Orders_StatusMatchesDelivery");
            Assert.False(o.Status == OrderStatus.EnRuta && o.Delivery == DeliveryMethod.Paqueteria, $"{o.Folio}: CK_Orders_StatusMatchesDelivery");
            Assert.True(o.PaymentStatus == PaymentStatus.Pagado || o.Status is OrderStatus.PorPreparar or OrderStatus.Cancelado, $"{o.Folio}: CK_Orders_PaymentBeforeFulfillment");
            Assert.Equal(o.PaymentStatus != PaymentStatus.Pendiente, o.PaidAgo is not null);

            // El historial va en orden y termina en el estado del pedido.
            var agos = o.History.Select(h => h.Ago).ToList();
            Assert.Equal(agos.OrderDescending(), agos);
            if (o.Status != OrderStatus.PorPreparar)
            {
                Assert.Equal(o.Status, o.History[^1].Status);
            }

            var shipped = o.Status is OrderStatus.Enviado or OrderStatus.EnRuta or OrderStatus.Entregado;
            if (shipped && o.Delivery == DeliveryMethod.Paqueteria)
            {
                Assert.Empty(OrderStateMachine.ValidateShipment(o.Delivery, o.Carrier == Carrier.Estafeta ? "estafeta" : "dhl_express", o.Tracking, null));
            }
            else if (shipped)
            {
                Assert.False(string.IsNullOrEmpty(o.Courier));
            }
        }
    }

    [Fact]
    public async Task Database_keeps_the_kardex_and_reserved_matching_and_seeding_again_changes_nothing()
    {
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SokkoDbContext>();

        var before = await Snapshot(db);
        await DevelopmentDataSeeder.SeedAsync(db, Ct);
        Assert.Equal(before, await Snapshot(db));

        var folios = Orders.Select(o => o.Folio).ToList();
        Assert.Equal(34, await db.Orders.CountAsync(o => folios.Contains(o.FolioNumber), Ct));

        var variants = await db.ProductVariants.AsNoTracking().Select(v => new { v.Id, v.Sku, v.Stock, v.Reserved }).ToListAsync(Ct);
        var open = await db.OrderItems
            .Where(i => i.Order.Status == OrderStatus.PorPreparar || i.Order.Status == OrderStatus.Preparando)
            .GroupBy(i => i.VariantId)
            .Select(g => new { g.Key, Units = g.Sum(i => i.Quantity) })
            .ToDictionaryAsync(x => x.Key, x => x.Units, Ct);
        var movements = await db.InventoryMovements.AsNoTracking().OrderBy(m => m.CreatedAt).ThenBy(m => m.Id).Select(m => new { m.VariantId, m.Quantity, m.Balance }).ToListAsync(Ct);

        foreach (var variant in variants)
        {
            // R-08: lo apartado es lo de los pedidos sin enviar.
            Assert.Equal(open.GetValueOrDefault(variant.Id), variant.Reserved);

            // R-19: en orden de fecha, cada saldo sale del anterior y el último es el stock.
            var kardex = movements.Where(m => m.VariantId == variant.Id).ToList();
            if (kardex.Count == 0)
            {
                Assert.Equal(0, variant.Stock);
                continue;
            }
            var balance = kardex[0].Balance - kardex[0].Quantity;
            foreach (var movement in kardex)
            {
                balance += movement.Quantity;
                Assert.Equal(balance, movement.Balance);
                Assert.True(balance >= 0, variant.Sku);
            }
            Assert.Equal(variant.Stock, balance);
        }

        // La tienda ve lo mismo que con la semilla limpia, y el folio sigue después de los demo. Un OXXO demo que venció
        // (la prueba de vencimiento adelanta el reloj) ya no aparta: sus unidades quedan libres.
        var seed = DevelopmentSeed.Variants.ToDictionary(v => v.Sku);
        var released = await db.OrderItems
            .Where(i => folios.Contains(i.Order.FolioNumber) && i.Order.Status == OrderStatus.Cancelado)
            .Select(i => new { i.Order.FolioNumber, i.SkuSnapshot, i.Quantity })
            .ToListAsync(Ct);
        var wasOpen = Orders.Where(o => o.Status is OrderStatus.PorPreparar or OrderStatus.Preparando).Select(o => o.Folio).ToHashSet();
        var freed = released.Where(r => wasOpen.Contains(r.FolioNumber)).GroupBy(r => r.SkuSnapshot).ToDictionary(g => g.Key, g => g.Sum(r => r.Quantity));
        Assert.All(variants.Where(v => seed.ContainsKey(v.Sku)), v => Assert.Equal(seed[v.Sku].Stock + freed.GetValueOrDefault(v.Sku), v.Stock - v.Reserved));
        var sequence = await db.Database.SqlQueryRaw<int>($"SELECT CAST(current_value AS int) AS [Value] FROM sys.sequences WHERE name = '{SokkoDbContext.OrderFolioSequence}'").SingleAsync(Ct);
        Assert.True(sequence >= 1060);
    }

    private static async Task<(int Orders, int Movements, int Stock, int Reserved)> Snapshot(SokkoDbContext db) => (
        await db.Orders.CountAsync(Ct),
        await db.InventoryMovements.CountAsync(Ct),
        await db.ProductVariants.SumAsync(v => v.Stock, Ct),
        await db.ProductVariants.SumAsync(v => v.Reserved, Ct));
}
