namespace Sokko.Api.DTOs;

/// <summary>Contrato de respuesta del endpoint de salud del servicio.</summary>
public record HealthResponseDto(string Status, string Service, string Message);
