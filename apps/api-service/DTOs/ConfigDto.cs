namespace Sokko.Api.DTOs;

/// <summary>Configuración pública de la tienda (<c>GET /api/config</c>, DESIGN_DB §3.12).</summary>
public record ConfigDto(
    decimal FreeShippingThreshold,
    decimal ParcelShippingCost,
    decimal LocalShippingCost,
    bool LocalFreeShipping,
    int FewUnitsThreshold,
    decimal IvaRate,
    bool PaymentsDemoMode = false);
