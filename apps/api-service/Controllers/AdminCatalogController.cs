using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Catálogo y productos del panel (DESIGN_CATALOG_UI §4.3). Consultar es de los dos roles; editar, solo del Dueño.</summary>
[Route("api/admin")]
[Authorize(Policy = Permissions.CatalogView)]
public class AdminCatalogController(ICatalogAdminService catalog) : AdminControllerBase
{
    [HttpGet("catalog")]
    public async Task<IActionResult> Catalog(CancellationToken cancellationToken)
    {
        var view = await catalog.GetCatalogAsync(cancellationToken);
        return IsOwner ? Ok(view.ToOwner()) : Ok(view.ToOperations());
    }

    [HttpGet("products")]
    public async Task<IActionResult> Products(CancellationToken cancellationToken)
    {
        var products = await catalog.ListProductsAsync(cancellationToken);
        return IsOwner ? Ok(products.Select(p => p.ToOwner()).ToList()) : Ok(products.Select(p => p.ToOperations()).ToList());
    }

    [HttpGet("products/{slug}")]
    public async Task<IActionResult> Product(string slug, CancellationToken cancellationToken)
    {
        var product = await catalog.GetProductAsync(slug, cancellationToken);
        if (product is null)
        {
            return NotFound();
        }
        return IsOwner ? Ok(product.ToOwner()) : Ok(product.ToOperations());
    }

    [HttpPost("products")]
    [Authorize(Policy = Permissions.CatalogEdit)]
    public async Task<IActionResult> Create(ProductRequestDto request, CancellationToken cancellationToken)
    {
        var result = await catalog.CreateProductAsync(request, cancellationToken);
        return result.Outcome == AdminOutcome.Ok
            ? Created($"/api/admin/products/{result.Value!.Base.Slug}", result.Value.ToOwner())
            : FailureOf(result);
    }

    [HttpPut("products/{slug}")]
    [Authorize(Policy = Permissions.CatalogEdit)]
    public async Task<IActionResult> Update(string slug, ProductRequestDto request, CancellationToken cancellationToken)
    {
        var result = await catalog.UpdateProductAsync(slug, request, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value!.ToOwner()) : FailureOf(result);
    }
}
