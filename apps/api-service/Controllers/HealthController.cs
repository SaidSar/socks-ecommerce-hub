using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Sokko.Api.DTOs;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController(HealthCheckService health) : ControllerBase
{
    private const string Service = "SOKKO API Service";

    /// <summary>Verifica que el servicio esté disponible y que alcance la base de datos. Despierta una BD serverless en pausa.</summary>
    [HttpGet]
    [ProducesResponseType<HealthResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<HealthResponseDto>(StatusCodes.Status503ServiceUnavailable)]
    public async Task<ActionResult<HealthResponseDto>> Get(CancellationToken cancellationToken)
    {
        var report = await health.CheckHealthAsync(cancellationToken);
        return report.Status == HealthStatus.Unhealthy
            // Sin el detalle del error: esta ruta es pública.
            ? StatusCode(StatusCodes.Status503ServiceUnavailable, new HealthResponseDto("Unhealthy", Service, "Sin conexión con la base de datos"))
            : Ok(new HealthResponseDto("OK", Service, "Confort que Renace cada paso"));
    }

    /// <summary>Solo el proceso, sin tocar la BD: un sondeo cada minuto aquí no impide la autopausa de la BD.</summary>
    [HttpGet("live")]
    [ProducesResponseType<HealthResponseDto>(StatusCodes.Status200OK)]
    public ActionResult<HealthResponseDto> Live() =>
        Ok(new HealthResponseDto("OK", Service, "Confort que Renace cada paso"));
}
