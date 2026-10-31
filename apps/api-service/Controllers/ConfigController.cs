using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/config")]
public class ConfigController(ISettingsService settings, IConfiguration configuration) : ControllerBase
{
    /// <summary>Configuración pública de la tienda.</summary>
    [HttpGet]
    [ProducesResponseType<ConfigDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<ConfigDto>> Get(CancellationToken cancellationToken) =>
        Ok(await settings.GetConfigAsync(cancellationToken) with { PaymentsDemoMode = configuration.GetValue("Payments:DemoMode", false) });
}
