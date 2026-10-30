using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController(ICatalogService catalog) : ControllerBase
{
    /// <summary>Listado de la tienda: aplica R-28; con <c>q</c> incluye la temporada inactiva con el precio de R-29.</summary>
    [HttpGet]
    [ProducesResponseType<PagedResultDto<ProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PagedResultDto<ProductDto>>> List([FromQuery] ProductQueryDto query, CancellationToken cancellationToken) =>
        Ok(await catalog.ListAsync(query, cancellationToken));

    /// <summary>Ficha por URL directa, también para temporada inactiva.</summary>
    [HttpGet("{slug}")]
    [ProducesResponseType<ProductDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ProductDto>> Get(string slug, CancellationToken cancellationToken) =>
        await catalog.GetBySlugAsync(slug, cancellationToken) is { } product ? Ok(product) : NotFound();
}
