using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;

namespace Sokko.Api.Services;

/// <summary>Servicio de tarea: cotiza el envío con el CP y el subtotal (R-14, DESIGN_DB §6).</summary>
public interface IQuoteShipping
{
    Task<ShippingQuoteDto> QuoteAsync(string postalCode, decimal subtotal, CancellationToken cancellationToken = default);
}

public class QuoteShipping(ISettingsService settings) : IQuoteShipping
{
    public async Task<ShippingQuoteDto> QuoteAsync(string postalCode, decimal subtotal, CancellationToken cancellationToken = default)
    {
        var config = await settings.GetConfigAsync(cancellationToken);
        var reachesFree = subtotal >= config.FreeShippingThreshold;

        if (await settings.IsLocalPostalCodeAsync(postalCode, cancellationToken))
        {
            return new ShippingQuoteDto(DeliveryMethod.Local, reachesFree && config.LocalFreeShipping ? 0m : config.LocalShippingCost);
        }

        return new ShippingQuoteDto(DeliveryMethod.Paqueteria, reachesFree ? 0m : config.ParcelShippingCost);
    }
}
