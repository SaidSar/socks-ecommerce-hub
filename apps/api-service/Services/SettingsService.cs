using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad de la configuración del negocio y las zonas locales (DESIGN_DB §3.12, §3.13).</summary>
public interface ISettingsService
{
    Task<ConfigDto> GetConfigAsync(CancellationToken cancellationToken = default);

    /// <summary>Slug de la pieza del hero, o <c>null</c> si no hay una publicada.</summary>
    Task<string?> GetFeaturedSlugAsync(CancellationToken cancellationToken = default);

    Task<bool> IsLocalPostalCodeAsync(string postalCode, CancellationToken cancellationToken = default);
}

public class SettingsService(SokkoDbContext db) : ISettingsService
{
    public Task<ConfigDto> GetConfigAsync(CancellationToken cancellationToken = default) =>
        db.Settings
            .AsNoTracking()
            .Select(s => new ConfigDto(
                s.FreeShippingThreshold,
                s.ParcelShippingCost,
                s.LocalShippingCost,
                s.LocalFreeShipping,
                s.FewUnitsThreshold,
                s.IvaRate))
            .SingleAsync(cancellationToken);

    public Task<string?> GetFeaturedSlugAsync(CancellationToken cancellationToken = default) =>
        db.Settings
            .AsNoTracking()
            .Where(s => s.FeaturedProduct != null && s.FeaturedProduct.IsActive)
            .Select(s => s.FeaturedProduct!.Slug)
            .FirstOrDefaultAsync(cancellationToken);

    public Task<bool> IsLocalPostalCodeAsync(string postalCode, CancellationToken cancellationToken = default) =>
        db.LocalDeliveryZones
            .AsNoTracking()
            .AnyAsync(
                z => z.IsActive && z.PostalCodeFrom.CompareTo(postalCode) <= 0 && z.PostalCodeTo.CompareTo(postalCode) >= 0,
                cancellationToken);
}
