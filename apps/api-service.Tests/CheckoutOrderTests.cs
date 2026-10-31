using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Reglas de <see cref="CheckoutOrder"/> sin BD: R-13, R-14, R-29, IVA y reversión.</summary>
public class CheckoutOrderTests
{
    private const string LocalCp = "81250";
    private const string OtherCp = "06700";
    private const string Sku = "ESP-001-ROJ-M";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private sealed class FakeUnitOfWork : IUnitOfWork
    {
        public int Commits { get; private set; }
        public int Rollbacks { get; private set; }
        public bool FailOnCommit { get; init; }

        public async Task<T> InTransactionAsync<T>(Func<CancellationToken, Task<(T Result, bool Commit)>> work, CancellationToken cancellationToken = default)
        {
            var (result, commit) = await work(cancellationToken);
            if (commit && FailOnCommit)
            {
                Rollbacks++;
                throw new InvalidOperationException("Falló el COMMIT.");
            }
            if (commit)
            {
                Commits++;
            }
            else
            {
                Rollbacks++;
            }
            return result;
        }
    }

    private sealed class FakeInventory(params ProductVariant[] variants) : IInventoryService
    {
        public List<StockLine> Reserved { get; } = [];
        public int ShortAvailable { get; init; } = -1;

        public Task<IReadOnlyList<ProductVariant>> GetForSaleAsync(IReadOnlyCollection<string> skus, CancellationToken cancellationToken = default) =>
            Task.FromResult<IReadOnlyList<ProductVariant>>(variants.Where(v => skus.Contains(v.Sku)).ToList());

        public Task<IReadOnlyList<StockShortage>> ReserveAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default)
        {
            var list = lines.ToList();
            Reserved.AddRange(list);
            IReadOnlyList<StockShortage> shortages = ShortAvailable < 0 ? [] : list.Select(l => new StockShortage(l.VariantId, l.Quantity, ShortAvailable)).ToList();
            return Task.FromResult(shortages);
        }

        public Task ReleaseAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<string>> SyncVariantsAsync(int productId, IReadOnlyList<VariantSpec> variants, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<string>>([]);
    }

    private sealed class FakeOrders : IOrderService
    {
        public Order? Created { get; private set; }
        public Order? Existing { get; init; }
        public bool LoseIdempotencyRace { get; init; }

        public Task<bool> CreateAsync(Order order, CancellationToken cancellationToken = default)
        {
            Created = order;
            return Task.FromResult(!LoseIdempotencyRace);
        }

        public Task RecordPaymentAsync(Order order, string reference, bool paid, DateTime at, CancellationToken cancellationToken = default)
        {
            order.PaymentReference = reference;
            order.PaymentStatus = paid ? PaymentStatus.Pagado : PaymentStatus.Pendiente;
            order.PaidAt = paid ? at : null;
            return Task.CompletedTask;
        }

        public Task<Order?> FindByIdempotencyKeyAsync(string key, CancellationToken cancellationToken = default) => Task.FromResult(Existing);
        public Task<Order?> FindByFolioAsync(string folio, CancellationToken cancellationToken = default) => Task.FromResult<Order?>(null);
        public Task<IReadOnlyList<Order>> ListByUserAsync(int userId, int limit, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Order>>([]);
        public Task<IReadOnlyList<int>> ListExpiredOxxoAsync(DateTime cutoff, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<int>>([]);
        public Task<IReadOnlyList<StockLine>?> CancelUnpaidOxxoAsync(int orderId, string note, DateTime at, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<StockLine>?>(null);
        public Task<bool> ConfirmOxxoPaymentAsync(string folio, DateTime at, CancellationToken cancellationToken = default) => Task.FromResult(false);
    }

    private sealed class SpyGateway : IPaymentGateway
    {
        private readonly FakePaymentGateway _inner = new();
        public List<PaymentRequest> Charges { get; } = [];
        public List<string> Voids { get; } = [];

        public Task<PaymentResult> ChargeAsync(PaymentRequest request, CancellationToken cancellationToken = default)
        {
            Charges.Add(request);
            return _inner.ChargeAsync(request, cancellationToken);
        }

        public Task VoidAsync(string reference, CancellationToken cancellationToken = default)
        {
            Voids.Add(reference);
            return Task.CompletedTask;
        }
    }

    private static readonly Collection Navidad = new()
    {
        Kind = CollectionKind.Temporada, StartMonth = 11, StartDay = 1, EndMonth = 1, EndDay = 6, OffSeasonDiscountPct = 0.30m,
    };

    private static ProductVariant Variant(decimal price, Collection? collection = null) => new()
    {
        Id = 7,
        Sku = Sku,
        Product = new Product { Name = "Copo Navideño", Price = price, Collection = collection },
        Color = new Color { Name = "Rojo" },
        Size = new Size { Code = "M" },
    };

    private sealed record Sut(CheckoutOrder Checkout, FakeUnitOfWork Work, FakeInventory Inventory, FakeOrders Orders, SpyGateway Gateway);

    private static Sut Build(ProductVariant variant, DateOnly? today = null, FakeUnitOfWork? work = null, FakeInventory? inventory = null, FakeOrders? orders = null)
    {
        work ??= new FakeUnitOfWork();
        inventory ??= new FakeInventory(variant);
        orders ??= new FakeOrders();
        var gateway = new SpyGateway();
        var clock = new FakeClock(today ?? new DateOnly(2026, 12, 15));
        var settings = new FakeSettingsService(new ConfigDto(799m, 99m, 49m, true, 4, 0.16m), LocalCp);
        var catalog = new CatalogService(TestDbContext.Create(), new CollectionService(TestDbContext.Create()), settings, clock);
        return new Sut(new CheckoutOrder(work, inventory, orders, catalog, settings, new QuoteShipping(settings), gateway, clock), work, inventory, orders, gateway);
    }

    private static CheckoutCommand Command(
        int quantity = 1, string postalCode = OtherCp, PaymentMethod method = PaymentMethod.Tarjeta,
        string? token = FakePaymentGateway.ApprovedToken, decimal? expectedTotal = null, string? key = null) =>
        new(null, " Ana ", "López", " ANA@correo.mx ", "6681234567", "Calle 1", "Centro", "Los Mochis", "Sinaloa", postalCode, "  ", true,
            method, token, expectedTotal, [new CheckoutLine(Sku, quantity)], key);

    [Fact]
    public async Task Off_season_line_is_charged_at_the_discounted_price_from_the_server()
    {
        var sut = Build(Variant(199m, Navidad), new DateOnly(2026, 10, 26));

        await sut.Checkout.PlaceAsync(Command(), Ct);

        Assert.Equal(139.30m, sut.Orders.Created!.Items.Single().UnitPrice);
        Assert.Equal(139.30m, sut.Orders.Created.Subtotal);
        Assert.Equal(238.30m, sut.Orders.Created.Total);
        Assert.Equal(238.30m, sut.Gateway.Charges.Single().Amount);
    }

    [Fact]
    public async Task In_season_line_keeps_the_list_price()
    {
        var sut = Build(Variant(199m, Navidad), new DateOnly(2026, 12, 15));

        await sut.Checkout.PlaceAsync(Command(), Ct);

        Assert.Equal(199m, sut.Orders.Created!.Items.Single().UnitPrice);
    }

    [Theory]
    [InlineData(LocalCp, 1, DeliveryMethod.Local, 49)]
    [InlineData(LocalCp, 2, DeliveryMethod.Local, 0)]
    [InlineData(OtherCp, 1, DeliveryMethod.Paqueteria, 99)]
    [InlineData(OtherCp, 2, DeliveryMethod.Paqueteria, 0)]
    public async Task Shipping_comes_from_the_quote(string postalCode, int quantity, DeliveryMethod method, int cost)
    {
        var sut = Build(Variant(400m));

        await sut.Checkout.PlaceAsync(Command(quantity, postalCode), Ct);

        Assert.Equal(method, sut.Orders.Created!.DeliveryMethod);
        Assert.Equal(cost, sut.Orders.Created.ShippingCost);
        Assert.Equal(400m * quantity + cost, sut.Orders.Created.Total);
    }

    [Fact]
    public async Task Tax_rate_comes_from_settings_and_customer_data_is_normalized()
    {
        var sut = Build(Variant(400m));

        await sut.Checkout.PlaceAsync(Command(), Ct);

        var order = sut.Orders.Created!;
        Assert.Equal(0.16m, order.TaxRate);
        Assert.Equal("Ana", order.CustomerFirstName);
        Assert.Equal("ana@correo.mx", order.CustomerEmail);
        Assert.Null(order.ShipReferences);
        Assert.True(order.GiftWrap);
    }

    [Theory]
    [InlineData(FakePaymentGateway.DeclinedToken, PaymentDecline.Declined)]
    [InlineData(FakePaymentGateway.InsufficientFundsToken, PaymentDecline.InsufficientFunds)]
    [InlineData(null, PaymentDecline.Declined)]
    public async Task Declined_card_rolls_everything_back(string? token, string code)
    {
        var sut = Build(Variant(400m));

        var result = await sut.Checkout.PlaceAsync(Command(token: token), Ct);

        Assert.Equal(code, Assert.IsType<CheckoutResult.Declined>(result).Code);
        Assert.Equal(1, sut.Work.Rollbacks);
        Assert.Equal(0, sut.Work.Commits);
    }

    [Fact]
    public async Task Card_order_is_paid_and_oxxo_stays_pending_with_a_reference()
    {
        var card = Build(Variant(400m));
        await card.Checkout.PlaceAsync(Command(), Ct);
        Assert.Equal(PaymentStatus.Pagado, card.Orders.Created!.PaymentStatus);
        Assert.NotNull(card.Orders.Created.PaidAt);

        var oxxo = Build(Variant(400m));
        await oxxo.Checkout.PlaceAsync(Command(method: PaymentMethod.OxxoPay, token: null), Ct);
        Assert.Equal(PaymentStatus.Pendiente, oxxo.Orders.Created!.PaymentStatus);
        Assert.Null(oxxo.Orders.Created.PaidAt);
        Assert.Matches("^93[0-9]{12}$", oxxo.Orders.Created.PaymentReference!);
    }

    [Fact]
    public async Task No_stock_rolls_back_without_charging()
    {
        var variant = Variant(400m);
        var sut = Build(variant, inventory: new FakeInventory(variant) { ShortAvailable = 1 });

        var result = await sut.Checkout.PlaceAsync(Command(3), Ct);

        var line = Assert.Single(Assert.IsType<CheckoutResult.OutOfStock>(result).Lines);
        Assert.Equal(new ShortageLine(Sku, 3, 1), line);
        Assert.Empty(sut.Gateway.Charges);
        Assert.Equal(1, sut.Work.Rollbacks);
    }

    [Fact]
    public async Task Unknown_sku_is_reported_as_out_of_stock()
    {
        var sut = Build(Variant(400m), inventory: new FakeInventory());

        var result = await sut.Checkout.PlaceAsync(Command(), Ct);

        Assert.Equal(0, Assert.Single(Assert.IsType<CheckoutResult.OutOfStock>(result).Lines).Available);
    }

    [Fact]
    public async Task Expected_total_is_compared_and_never_charged()
    {
        var sut = Build(Variant(400m));

        var result = await sut.Checkout.PlaceAsync(Command(expectedTotal: 1m), Ct);

        Assert.Equal(499m, Assert.IsType<CheckoutResult.PriceChanged>(result).Total);
        Assert.Empty(sut.Gateway.Charges);
        Assert.Equal(1, sut.Work.Rollbacks);
    }

    [Fact]
    public async Task Repeated_skus_are_merged_into_one_line()
    {
        var sut = Build(Variant(100m));
        var command = Command() with { Items = [new CheckoutLine(Sku, 1), new CheckoutLine(Sku.ToLowerInvariant(), 2)] };

        await sut.Checkout.PlaceAsync(command, Ct);

        Assert.Equal(3, sut.Orders.Created!.Items.Single().Quantity);
        Assert.Equal(new StockLine(7, 3), sut.Inventory.Reserved.Single());
    }

    [Fact]
    public async Task Failed_commit_voids_the_approved_charge()
    {
        var sut = Build(Variant(400m), work: new FakeUnitOfWork { FailOnCommit = true });

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Checkout.PlaceAsync(Command(), Ct));

        Assert.Single(sut.Gateway.Voids);
    }

    [Fact]
    public async Task Same_key_with_other_data_is_a_conflict_and_never_charges()
    {
        var first = Build(Variant(400m));
        await first.Checkout.PlaceAsync(Command(key: "llave"), Ct);
        var previous = first.Orders.Created!;

        var replay = Build(Variant(400m), orders: new FakeOrders { Existing = previous });
        Assert.True(Assert.IsType<CheckoutResult.Created>(await replay.Checkout.PlaceAsync(Command(key: "llave"), Ct)).Replayed);
        Assert.Empty(replay.Gateway.Charges);

        var other = Build(Variant(400m), orders: new FakeOrders { Existing = previous });
        Assert.IsType<CheckoutResult.IdempotencyConflict>(await other.Checkout.PlaceAsync(Command(2, key: "llave"), Ct));
        Assert.Empty(other.Gateway.Charges);
    }
}
