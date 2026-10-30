using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Tests;

internal sealed class FakeClock(DateOnly today) : IClock
{
    public DateOnly Today { get; set; } = today;

    public DateTime UtcNow => Today.ToDateTime(new TimeOnly(19, 0), DateTimeKind.Utc);
}

internal sealed class FakeSettingsService(ConfigDto config, params string[] localPostalCodes) : ISettingsService
{
    public Task<ConfigDto> GetConfigAsync(CancellationToken cancellationToken = default) => Task.FromResult(config);

    public Task<string?> GetFeaturedSlugAsync(CancellationToken cancellationToken = default) => Task.FromResult<string?>(null);

    public Task<bool> IsLocalPostalCodeAsync(string postalCode, CancellationToken cancellationToken = default) =>
        Task.FromResult(localPostalCodes.Contains(postalCode));
}
