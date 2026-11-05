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
        public Task<int> FindVariantIdAsync(string sku, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<bool> SetStockAsync(StockChange change, StaffActor actor, DateTime at, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task ApplyCatalogFieldsAsync(int variantId, int productId, decimal? unitCost, string? barcode, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<bool> TryReleaseAsync(IEnumerable<StockLine> lines, CancellationToken cancellationToken = default) => Task.FromResult(true);
        public Task<bool> ShipAsync(IReadOnlyList<StockLine> lines, int orderId, string note, StaffActor actor, DateTime at, CancellationToken cancellationToken = default) => Task.FromResult(true);
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

    /// <summary>Cupones en memoria con las mismas reglas que <see cref="CouponService"/>.</summary>
    internal sealed class FakeCoupons(IClock clock, params Coupon[] coupons) : ICouponService
    {
        public List<(int CouponId, int OrderId, string Email, decimal Discount)> Redeemed { get; } = [];

        public Task<CouponLookup> FindApplicableAsync(string? code, decimal subtotal, string? email, bool forCheckout, CancellationToken cancellationToken = default)
        {
            var coupon = coupons.FirstOrDefault(c => c.Code == CouponRules.Normalize(code));
            if (coupon is null)
            {
                return Task.FromResult(CouponLookup.Rejected(CouponRules.NotFoundRejection));
            }
            var mine = email is null ? (bool?)null : Redeemed.Any(r => r.CouponId == coupon.Id && r.Email == UserService.NormalizeEmail(email));
            var rejection = CouponRules.Check(coupon, clock.Today, subtotal, Redeemed.Count(r => r.CouponId == coupon.Id), mine);
            return Task.FromResult(rejection is null ? CouponLookup.Applies(coupon) : CouponLookup.Rejected(rejection));
        }

        public Task RedeemAsync(int couponId, int orderId, string email, decimal discount, DateTime at, CancellationToken cancellationToken = default)
        {
            Redeemed.Add((couponId, orderId, email, discount));
            return Task.CompletedTask;
        }

        public Task ReleaseAsync(int orderId, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<IReadOnlyList<AdminCouponDto>> ListAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AdminCouponDto?> GetAsync(int id, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AdminResult<AdminCouponDto>> CreateAsync(AdminCouponRequestDto request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AdminResult<AdminCouponDto>> UpdateAsync(int id, AdminCouponRequestDto request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AdminResult<AdminCouponDto>> SetActiveAsync(int id, bool active, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public Task<AdminResult<bool>> DeleteAsync(int id, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class SpyConfirmation : IOrderConfirmation
    {
        public List<string> Sent { get; } = [];

        public Task SendAsync(string folio)
        {
            Sent.Add(folio);
            return Task.CompletedTask;
        }
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

    private sealed record Sut(CheckoutOrder Checkout, FakeUnitOfWork Work, FakeInventory Inventory, FakeOrders Orders, SpyGateway Gateway, SpyConfirmation Confirmation, FakeCoupons Coupons);

    private static Sut Build(ProductVariant variant, DateOnly? today = null, FakeUnitOfWork? work = null, FakeInventory? inventory = null, FakeOrders? orders = null, FakeCoupons? coupons = null)
    {
        work ??= new FakeUnitOfWork();
        inventory ??= new FakeInventory(variant);
        orders ??= new FakeOrders();
        var gateway = new SpyGateway();
        var clock = new FakeClock(today ?? new DateOnly(2026, 12, 15));
        var settings = new FakeSettingsService(new ConfigDto(799m, 99m, 49m, true, 4, 0.16m), LocalCp);
        var catalog = new CatalogService(TestDbContext.Create(), new CollectionService(TestDbContext.Create(), new FakeClock(new DateOnly(2026, 10, 26))), settings, clock);
        var confirmation = new SpyConfirmation();
        coupons ??= new FakeCoupons(clock);
        var quote = new QuoteOrder(new QuoteShipping(settings), settings);
        return new Sut(new CheckoutOrder(work, inventory, orders, catalog, settings, quote, coupons, gateway, confirmation, clock), work, inventory, orders, gateway, confirmation, coupons);
    }

    private static CheckoutCommand Command(
        int quantity = 1, string postalCode = OtherCp, PaymentMethod method = PaymentMethod.Tarjeta,
        string? token = FakePaymentGateway.ApprovedToken, decimal? expectedTotal = null, string? key = null, string? coupon = null) =>
        new(null, " Ana ", "López", " ANA@correo.mx ", "6681234567", "Calle 1", "Centro", "Los Mochis", "Sinaloa", postalCode, "  ", true,
            method, token, expectedTotal, [new CheckoutLine(Sku, quantity)], key, coupon);

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
        Assert.Empty(sut.Confirmation.Sent);
    }

    [Fact]
    public async Task Confirmation_goes_out_once_after_the_commit_and_not_on_a_replay()
    {
        var first = Build(Variant(400m));
        await first.Checkout.PlaceAsync(Command(key: "llave"), Ct);
        Assert.Single(first.Confirmation.Sent);
        Assert.Equal(1, first.Work.Commits);

        var replay = Build(Variant(400m), orders: new FakeOrders { Existing = first.Orders.Created });
        await replay.Checkout.PlaceAsync(Command(key: "llave"), Ct);
        Assert.Empty(replay.Confirmation.Sent);
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

    // --- Cupones (D-40) ---

    private static Coupon CouponOf(string code, CouponType type, decimal value, int id = 1) =>
        new() { Id = id, Code = code, Type = type, Value = value, IsActive = true };

    private static Sut BuildWith(ProductVariant variant, params Coupon[] coupons)
    {
        var clock = new FakeClock(new DateOnly(2026, 12, 15));
        return Build(variant, coupons: new FakeCoupons(clock, coupons));
    }

    [Fact]
    public async Task Percent_coupon_discounts_the_merchandise_and_is_charged_and_redeemed()
    {
        var sut = BuildWith(Variant(559m), CouponOf("BIENVENIDA10", CouponType.Percent, 10));

        var result = await sut.Checkout.PlaceAsync(Command(coupon: "BIENVENIDA10"), Ct);

        Assert.IsType<CheckoutResult.Created>(result);
        var order = sut.Orders.Created!;
        Assert.Equal("BIENVENIDA10", order.CouponCode);
        Assert.Equal(559m, order.Subtotal);
        Assert.Equal(55.90m, order.DiscountAmount);
        Assert.Equal(99m, order.ShippingCost);
        Assert.Equal(602.10m, order.Total);
        Assert.Equal(order.Subtotal - order.DiscountAmount + order.ShippingCost, order.Total);
        Assert.Equal(602.10m, sut.Gateway.Charges.Single().Amount);
        Assert.Equal((1, order.Id, "ana@correo.mx", 55.90m), sut.Coupons.Redeemed.Single());
    }

    [Fact]
    public async Task Courtesy_shipping_threshold_is_checked_after_the_discount()
    {
        // 2 × $400 = $800 llega al umbral de $799, pero con 10 % quedan $720: se cobra el envío.
        var sut = BuildWith(Variant(400m), CouponOf("DIEZ", CouponType.Percent, 10));

        await sut.Checkout.PlaceAsync(Command(2, coupon: "DIEZ"), Ct);

        Assert.Equal(80m, sut.Orders.Created!.DiscountAmount);
        Assert.Equal(99m, sut.Orders.Created.ShippingCost);
        Assert.Equal(819m, sut.Orders.Created.Total);
    }

    [Fact]
    public async Task Fixed_coupon_larger_than_the_subtotal_leaves_merchandise_at_zero_but_keeps_shipping()
    {
        var sut = BuildWith(Variant(400m), CouponOf("MIL", CouponType.Fixed, 1000));

        await sut.Checkout.PlaceAsync(Command(coupon: "MIL"), Ct);

        Assert.Equal(400m, sut.Orders.Created!.DiscountAmount);
        Assert.Equal(99m, sut.Orders.Created.ShippingCost);
        Assert.Equal(99m, sut.Orders.Created.Total);
    }

    [Theory]
    [InlineData(LocalCp, DeliveryMethod.Local)]
    [InlineData(OtherCp, DeliveryMethod.Paqueteria)]
    public async Task Free_shipping_coupon_zeroes_local_and_parcel_shipping(string postalCode, DeliveryMethod method)
    {
        var sut = BuildWith(Variant(100m), CouponOf("ENVIOGRATIS", CouponType.FreeShipping, 0));

        await sut.Checkout.PlaceAsync(Command(postalCode: postalCode, coupon: "envio gratis"), Ct);

        Assert.Equal(method, sut.Orders.Created!.DeliveryMethod);
        Assert.Equal(0m, sut.Orders.Created.ShippingCost);
        Assert.Equal(0m, sut.Orders.Created.DiscountAmount);
        Assert.Equal(100m, sut.Orders.Created.Total);
    }

    [Fact]
    public async Task Percent_discount_rounds_half_away_from_zero()
    {
        // 15 % de $333.30 = $49.995 → $50.00.
        var sut = BuildWith(Variant(333.30m), CouponOf("QUINCE", CouponType.Percent, 15));

        await sut.Checkout.PlaceAsync(Command(coupon: "QUINCE"), Ct);

        Assert.Equal(50.00m, sut.Orders.Created!.DiscountAmount);
    }

    [Fact]
    public async Task Coupon_that_stopped_applying_is_rejected_with_the_total_without_it_and_nothing_is_charged()
    {
        var expired = CouponOf("NOVIEMBRE", CouponType.Percent, 10);
        expired.EndsOn = new DateOnly(2026, 11, 30);
        var sut = BuildWith(Variant(400m), expired);

        var result = await sut.Checkout.PlaceAsync(Command(coupon: "NOVIEMBRE", expectedTotal: 459m), Ct);

        var invalid = Assert.IsType<CheckoutResult.CouponInvalid>(result);
        Assert.Equal(CouponRules.Expired, invalid.Reason);
        Assert.Equal("Este código venció el 30 de noviembre.", invalid.Message);
        Assert.Equal(499m, invalid.Total);
        Assert.Empty(sut.Gateway.Charges);
        Assert.Equal(1, sut.Work.Rollbacks);
        Assert.Empty(sut.Coupons.Redeemed);
    }

    [Fact]
    public async Task Expected_total_must_include_the_discount()
    {
        var withCoupon = BuildWith(Variant(400m), CouponOf("DIEZ", CouponType.Percent, 10));
        Assert.IsType<CheckoutResult.Created>(await withCoupon.Checkout.PlaceAsync(Command(coupon: "DIEZ", expectedTotal: 459m), Ct));

        var stale = BuildWith(Variant(400m), CouponOf("DIEZ", CouponType.Percent, 10));
        Assert.Equal(459m, Assert.IsType<CheckoutResult.PriceChanged>(await stale.Checkout.PlaceAsync(Command(coupon: "DIEZ", expectedTotal: 499m), Ct)).Total);
        Assert.Empty(stale.Gateway.Charges);
    }

    [Fact]
    public async Task Coupon_code_is_part_of_the_idempotency_hash()
    {
        var first = BuildWith(Variant(400m), CouponOf("DIEZ", CouponType.Percent, 10));
        await first.Checkout.PlaceAsync(Command(key: "llave", coupon: "DIEZ"), Ct);
        var previous = first.Orders.Created!;

        var replay = Build(Variant(400m), orders: new FakeOrders { Existing = previous });
        Assert.True(Assert.IsType<CheckoutResult.Created>(await replay.Checkout.PlaceAsync(Command(key: "llave", coupon: " diez "), Ct)).Replayed);

        var withoutCoupon = Build(Variant(400m), orders: new FakeOrders { Existing = previous });
        Assert.IsType<CheckoutResult.IdempotencyConflict>(await withoutCoupon.Checkout.PlaceAsync(Command(key: "llave"), Ct));
        Assert.Empty(withoutCoupon.Gateway.Charges);
    }
}
