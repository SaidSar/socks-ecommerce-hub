using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

/// <summary>Mismos casos que <c>apps/web-store/src/domain/season.test.js</c>: R-28, R-29 y fecha local.</summary>
public class SeasonTests
{
    private static readonly Collection Navidad = Season(11, 1, 1, 6);
    private static readonly Collection Halloween = Season(10, 1, 11, 2);
    private static readonly Collection Anime = new() { Kind = CollectionKind.Tematica, OffSeasonDiscountPct = 0.30m };

    private static readonly ConfigDto AnyConfig = new(799m, 99m, 49m, true, 4, 0.16m);

    private readonly CollectionService _collections = new(TestDbContext.Create());
    private readonly CatalogService _catalog;

    public SeasonTests()
    {
        _catalog = new CatalogService(TestDbContext.Create(), _collections, new FakeSettingsService(AnyConfig), new FakeClock(new DateOnly(2026, 10, 26)));
    }

    private static Collection Season(byte startMonth, byte startDay, byte endMonth, byte endDay) => new()
    {
        Kind = CollectionKind.Temporada,
        StartMonth = startMonth,
        StartDay = startDay,
        EndMonth = endMonth,
        EndDay = endDay,
        OffSeasonDiscountPct = 0.30m,
    };

    private static DateOnly D(int month, int day, int year = 2026) => new(year, month, day);

    [Theory]
    [InlineData(9, 30, false)]
    [InlineData(10, 1, true)]
    [InlineData(10, 26, true)]
    [InlineData(11, 2, true)]
    [InlineData(11, 3, false)]
    public void Normal_window_has_inclusive_ends(int month, int day, bool expected) =>
        Assert.Equal(expected, _collections.IsInWindow(Halloween, D(month, day)));

    [Theory]
    [InlineData(10, 31, false)]
    [InlineData(11, 1, true)]
    [InlineData(11, 30, true)]
    [InlineData(12, 31, true)]
    [InlineData(1, 6, true)]
    [InlineData(1, 7, false)]
    public void Window_can_cross_the_year(int month, int day, bool expected) =>
        Assert.Equal(expected, _collections.IsInWindow(Navidad, D(month, day)));

    [Theory]
    [InlineData(11, 30, false)]
    [InlineData(12, 31, true)]
    [InlineData(1, 3, true)]
    [InlineData(1, 7, false)]
    public void December_to_january_window_matches_the_design_examples(int month, int day, bool expected) =>
        Assert.Equal(expected, _collections.IsInWindow(Season(12, 1, 1, 6), D(month, day)));

    [Fact]
    public void Leap_day_follows_the_same_rule()
    {
        var leapDay = new DateOnly(2028, 2, 29);
        Assert.True(_collections.IsInWindow(Season(2, 1, 3, 1), leapDay));
        Assert.True(_collections.IsInWindow(Season(12, 1, 3, 1), leapDay));
        Assert.False(_collections.IsInWindow(Season(12, 1, 2, 28), leapDay));
        Assert.False(_collections.IsInWindow(Navidad, leapDay));
    }

    [Fact]
    public void Themed_or_missing_collection_is_always_in_season()
    {
        Assert.True(_collections.IsInWindow(Anime, D(3, 20)));
        Assert.True(_collections.IsInWindow(null, D(3, 20)));
    }

    [Fact]
    public void Off_season_price_is_discounted()
    {
        var product = new Product { Price = 199m, Collection = Navidad };
        Assert.Equal(new EffectivePrice(199m, 139.30m, true, 0.30m), _catalog.GetEffectivePrice(product, D(10, 26)));
        Assert.False(_catalog.IsInSeason(product, D(10, 26)));
    }

    [Fact]
    public void In_season_price_is_the_list_price()
    {
        var product = new Product { Price = 199m, Collection = Navidad };
        Assert.Equal(new EffectivePrice(199m, 199m, false, 0m), _catalog.GetEffectivePrice(product, D(12, 15)));
        Assert.True(_catalog.IsInSeason(product, D(12, 15)));
    }

    [Fact]
    public void Themed_or_no_collection_keeps_the_list_price()
    {
        Assert.Equal(239m, _catalog.GetEffectivePrice(new Product { Price = 239m, Collection = Anime }, D(3, 20)).FinalPrice);
        Assert.Equal(420m, _catalog.GetEffectivePrice(new Product { Price = 420m }, D(3, 20)).FinalPrice);
    }

    [Theory]
    [InlineData(179, 125.30)]
    [InlineData(189, 132.30)]
    public void Discounted_price_rounds_to_cents(int price, double expected) =>
        Assert.Equal((decimal)expected, _catalog.GetEffectivePrice(new Product { Price = price, Collection = Halloween }, D(12, 15)).FinalPrice);

    [Fact]
    public void Rounding_sends_midpoints_away_from_zero()
    {
        var collection = Season(10, 1, 11, 2);
        collection.OffSeasonDiscountPct = 0.50m;
        Assert.Equal(0.13m, _catalog.GetEffectivePrice(new Product { Price = 0.25m, Collection = collection }, D(12, 15)).FinalPrice);
    }

    [Fact]
    public void Business_date_uses_america_mazatlan()
    {
        Assert.Equal(new DateOnly(2026, 12, 14), SystemClock.ToBusinessDate(new DateTime(2026, 12, 15, 5, 0, 0, DateTimeKind.Utc)));
        Assert.Equal(new DateOnly(2026, 12, 15), SystemClock.ToBusinessDate(new DateTime(2026, 12, 15, 8, 0, 0, DateTimeKind.Utc)));
    }
}
