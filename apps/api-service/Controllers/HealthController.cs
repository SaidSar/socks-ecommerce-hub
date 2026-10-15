using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    /// <summary>Verifica que el servicio SOKKO esté disponible.</summary>
    [HttpGet]
    [ProducesResponseType<HealthResponseDto>(StatusCodes.Status200OK)]
    public ActionResult<HealthResponseDto> Get() =>
        Ok(new HealthResponseDto(
            Status: "OK",
            Service: "SOKKO API Service",
            Message: "Confort que Renace cada paso"));
}
