namespace Sokko.Api.DTOs;

/// <summary>Zona como la muestra el panel: <c>Value</c> = "81200–81299" o "81250".</summary>
public record AdminZoneDto(string Value, string Label);

/// <summary>Configuración del panel: lo mismo que <c>GET /api/config</c> más las zonas locales. Solo para el Dueño.</summary>
public record AdminSettingsDto(
    decimal FreeShippingThreshold,
    decimal ParcelShippingCost,
    decimal LocalShippingCost,
    bool LocalFreeShipping,
    int FewUnitsThreshold,
    decimal IvaRate,
    IReadOnlyList<AdminZoneDto> LocalZones,
    byte[] RowVersion);

public class AdminZoneRequestDto
{
    public string? Value { get; init; }

    public string? Label { get; init; }
}

/// <summary>El IVA no se edita en el panel: se conserva el vigente.</summary>
public class AdminSettingsRequestDto
{
    public decimal? FreeShippingThreshold { get; init; }

    public decimal? ParcelShippingCost { get; init; }

    public decimal? LocalShippingCost { get; init; }

    public bool LocalFreeShipping { get; init; }

    public int? FewUnitsThreshold { get; init; }

    public List<AdminZoneRequestDto>? LocalZones { get; init; }

    public byte[]? RowVersion { get; init; }
}
