using System.Collections.Concurrent;
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

    public Task<AdminSettingsDto> GetAdminAsync(CancellationToken cancellationToken = default) => throw new NotSupportedException();

    public Task<AdminResult<AdminSettingsDto>> SaveAdminAsync(AdminSettingsRequestDto request, int userId, CancellationToken cancellationToken = default) => throw new NotSupportedException();
}

/// <summary>Almacenamiento de fotos en memoria: las pruebas no tocan Azure ni el disco.</summary>
internal sealed class InMemoryImageStorage : IImageStorage
{
    public const string BaseUrl = "https://fotos.example.com/product-images/";

    public ConcurrentDictionary<string, (byte[] Content, string ContentType)> Blobs { get; } = new();

    /// <summary>Si se pone, la siguiente subida o borrado falla con esta excepción.</summary>
    public Exception? NextFailure { get; set; }

    public async Task<string> UploadAsync(string blobName, Stream content, string contentType, CancellationToken cancellationToken = default)
    {
        ThrowIfFailing();
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy, cancellationToken);
        Blobs[blobName] = (copy.ToArray(), contentType);
        return BaseUrl + blobName;
    }

    public Task DeleteAsync(string blobName, CancellationToken cancellationToken = default)
    {
        ThrowIfFailing();
        Blobs.TryRemove(blobName, out _);
        return Task.CompletedTask;
    }

    private void ThrowIfFailing()
    {
        if (NextFailure is { } failure)
        {
            NextFailure = null;
            throw failure;
        }
    }
}
