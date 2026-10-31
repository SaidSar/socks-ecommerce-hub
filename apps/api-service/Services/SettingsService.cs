using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Sokko.Api.Data;
using Sokko.Api.DTOs;
using Sokko.Api.Models;

namespace Sokko.Api.Services;

/// <summary>Servicio de entidad de la configuración del negocio y las zonas locales (DESIGN_DB §3.12, §3.13).</summary>
public interface ISettingsService
{
    Task<ConfigDto> GetConfigAsync(CancellationToken cancellationToken = default);

    /// <summary>Slug de la pieza del hero, o <c>null</c> si no hay una publicada.</summary>
    Task<string?> GetFeaturedSlugAsync(CancellationToken cancellationToken = default);

    Task<bool> IsLocalPostalCodeAsync(string postalCode, CancellationToken cancellationToken = default);

    /// <summary>Configuración y zonas activas, para el panel.</summary>
    Task<AdminSettingsDto> GetAdminAsync(CancellationToken cancellationToken = default);

    /// <summary>Valida R-21 y R-22 y guarda. Una zona que se quita pasa a inactiva (baja lógica).</summary>
    Task<AdminResult<AdminSettingsDto>> SaveAdminAsync(AdminSettingsRequestDto request, int userId, CancellationToken cancellationToken = default);
}

public partial class SettingsService(SokkoDbContext db, IClock clock) : ISettingsService
{
    private const string UnconfirmedSuffix = " · por confirmar";
    private const string AmountError = "Escriba un monto entero de 0 o más.";
    private const string ThresholdError = "El umbral debe ser mayor a 0.";

    [GeneratedRegex(@"^([0-9]{5})(?:\s*[–-]\s*([0-9]{5}))?$")]
    private static partial Regex ZonePattern();

    private static AdminZoneDto ToZoneDto(LocalDeliveryZone z) => new(
        z.PostalCodeFrom == z.PostalCodeTo ? z.PostalCodeFrom : $"{z.PostalCodeFrom}–{z.PostalCodeTo}",
        z.IsConfirmed ? z.Label : z.Label + UnconfirmedSuffix);

    public async Task<AdminSettingsDto> GetAdminAsync(CancellationToken cancellationToken = default)
    {
        var settings = await db.Settings.AsNoTracking().SingleAsync(cancellationToken);
        var zones = await db.LocalDeliveryZones.AsNoTracking().Where(z => z.IsActive).OrderBy(z => z.PostalCodeFrom).ToListAsync(cancellationToken);
        return new AdminSettingsDto(
            settings.FreeShippingThreshold,
            settings.ParcelShippingCost,
            settings.LocalShippingCost,
            settings.LocalFreeShipping,
            settings.FewUnitsThreshold,
            settings.IvaRate,
            zones.Select(ToZoneDto).ToList(),
            settings.RowVersion);
    }

    private static bool IsWholeAmount(decimal? amount) => amount is >= 0 && amount % 1 == 0;

    public async Task<AdminResult<AdminSettingsDto>> SaveAdminAsync(AdminSettingsRequestDto request, int userId, CancellationToken cancellationToken = default)
    {
        var errors = new Dictionary<string, string>();
        // R-22: montos enteros de 0 o más; el umbral de envío gratis, mayor a 0.
        if (!IsWholeAmount(request.FreeShippingThreshold))
        {
            errors["freeShippingThreshold"] = AmountError;
        }
        else if (request.FreeShippingThreshold == 0)
        {
            errors["freeShippingThreshold"] = ThresholdError;
        }
        if (!IsWholeAmount(request.ParcelShippingCost))
        {
            errors["parcelShippingCost"] = AmountError;
        }
        if (!IsWholeAmount(request.LocalShippingCost))
        {
            errors["localShippingCost"] = AmountError;
        }
        if (request.FewUnitsThreshold is not > 0)
        {
            errors["fewUnitsThreshold"] = ThresholdError;
        }
        if (request.RowVersion is null)
        {
            errors["rowVersion"] = ConcurrencyExceptionFilter.StaleMessage;
        }

        var parsed = new List<(string From, string To, string Label, bool Confirmed)>();
        if (request.LocalZones is not { Count: > 0 })
        {
            errors["localZones"] = "Agregue al menos un código postal a la zona local.";
        }
        else
        {
            foreach (var zone in request.LocalZones)
            {
                var match = ZonePattern().Match(zone.Value?.Trim() ?? "");
                var from = match.Groups[1].Value;
                var to = match.Groups[2].Success ? match.Groups[2].Value : from;
                if (!match.Success || string.CompareOrdinal(from, to) > 0)
                {
                    errors["localZones"] = "Hay códigos postales con formato inválido.";
                    break;
                }
                var label = zone.Label?.Trim() ?? "";
                var confirmed = !label.EndsWith(UnconfirmedSuffix, StringComparison.Ordinal);
                label = confirmed ? label : label[..^UnconfirmedSuffix.Length];
                parsed.Add((from, to, label.Length == 0 ? "Zona local" : label[..Math.Min(label.Length, 80)], confirmed));
            }

            // R-21: los rangos no se enciman.
            var sorted = parsed.OrderBy(z => z.From, StringComparer.Ordinal).ToList();
            if (!errors.ContainsKey("localZones") && sorted.Zip(sorted.Skip(1)).Any(pair => string.CompareOrdinal(pair.First.To, pair.Second.From) >= 0))
            {
                errors["localZones"] = "Hay rangos de códigos postales encimados.";
            }
        }
        if (errors.Count > 0)
        {
            return AdminResult<AdminSettingsDto>.Invalid(errors);
        }

        var settings = await db.Settings.SingleAsync(cancellationToken);
        db.Entry(settings).Property(s => s.RowVersion).OriginalValue = request.RowVersion!;
        var now = clock.UtcNow;
        settings.FreeShippingThreshold = request.FreeShippingThreshold!.Value;
        settings.ParcelShippingCost = request.ParcelShippingCost!.Value;
        settings.LocalShippingCost = request.LocalShippingCost!.Value;
        settings.LocalFreeShipping = request.LocalFreeShipping;
        settings.FewUnitsThreshold = request.FewUnitsThreshold!.Value;
        settings.UpdatedByUserId = userId;
        // Siempre cambia: así toda edición pasa por la comprobación de RowVersion.
        settings.UpdatedAt = now;

        var zones = await db.LocalDeliveryZones.ToListAsync(cancellationToken);
        foreach (var zone in zones)
        {
            var wanted = parsed.FirstOrDefault(p => p.From == zone.PostalCodeFrom && p.To == zone.PostalCodeTo);
            zone.IsActive = wanted.From is not null;
            if (wanted.From is not null)
            {
                zone.Label = wanted.Label;
                zone.IsConfirmed = wanted.Confirmed;
            }
        }
        foreach (var zone in parsed.Where(p => !zones.Any(z => z.PostalCodeFrom == p.From && z.PostalCodeTo == p.To)))
        {
            db.LocalDeliveryZones.Add(new LocalDeliveryZone { PostalCodeFrom = zone.From, PostalCodeTo = zone.To, Label = zone.Label, IsConfirmed = zone.Confirmed, CreatedAt = now });
        }
        await db.SaveChangesAsync(cancellationToken);
        return AdminResult<AdminSettingsDto>.Ok(await GetAdminAsync(cancellationToken));
    }

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
