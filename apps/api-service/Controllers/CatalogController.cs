using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/catalog")]
public class CatalogController(ICatalogService catalog) : ControllerBase
{
    /// <summary>Datos para armar el menú de la tienda.</summary>
    [HttpGet("nav")]
    [ProducesResponseType<CatalogNavDto>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CatalogNavDto>> Nav(CancellationToken cancellationToken) =>
        Ok(await catalog.GetNavAsync(cancellationToken));
}
