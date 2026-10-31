using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Marcas, tipos y colecciones (DESIGN_CATALOG_UI §4.4–§4.6). Consultar es de los dos roles; editar, solo del Dueño. No hay DELETE: la baja es lógica.</summary>
[Route("api/admin")]
[Authorize(Policy = Permissions.CatalogView)]
public class AdminTaxonomyController(
    ICatalogAdminService catalog,
    IBrandService brands,
    IProductTypeService types,
    ICollectionService collections) : AdminControllerBase
{
    private async Task<IActionResult> Saved<T>(AdminResult<string> result, bool created, string location, Func<AdminCatalogView, T?> pick, CancellationToken cancellationToken)
    {
        if (result.Outcome != AdminOutcome.Ok)
        {
            return FailureOf(result);
        }
        var value = pick(await catalog.GetCatalogAsync(cancellationToken));
        return created ? Created($"{location}/{result.Value}", value) : Ok(value);
    }

    private static AdminBrandDto? BrandOf(AdminCatalogView view, string? slug) => view.Brands.FirstOrDefault(b => b.Slug == slug);

    private static AdminProductTypeDto? TypeOf(AdminCatalogView view, string? code) => view.Types.FirstOrDefault(t => t.Code == code);

    private static AdminCollectionView? CollectionOf(AdminCatalogView view, string? slug) => view.Collections.FirstOrDefault(c => c.Owner.Slug == slug);

    // ---------------------------------------------------------------- Marcas

    [HttpGet("brands")]
    public async Task<IActionResult> Brands(CancellationToken cancellationToken) =>
        Ok((await catalog.GetCatalogAsync(cancellationToken)).Brands);

    [HttpGet("brands/{slug}")]
    public async Task<IActionResult> Brand(string slug, CancellationToken cancellationToken) =>
        BrandOf(await catalog.GetCatalogAsync(cancellationToken), slug) is { } brand ? Ok(brand) : NotFound();

    [HttpPost("brands")]
    [Authorize(Policy = Permissions.BrandsEdit)]
    public async Task<IActionResult> CreateBrand(BrandCreateDto request, CancellationToken cancellationToken)
    {
        var result = await brands.CreateAsync(request, cancellationToken);
        return await Saved(result, true, "/api/admin/brands", view => BrandOf(view, result.Value), cancellationToken);
    }

    [HttpPut("brands/{slug}")]
    [Authorize(Policy = Permissions.BrandsEdit)]
    public async Task<IActionResult> UpdateBrand(string slug, BrandUpdateDto request, CancellationToken cancellationToken)
    {
        var result = await brands.UpdateAsync(slug, request, cancellationToken);
        return await Saved(result, false, "/api/admin/brands", view => BrandOf(view, result.Value), cancellationToken);
    }

    // ---------------------------------------------------------------- Tipos

    [HttpGet("product-types")]
    public async Task<IActionResult> ProductTypes(CancellationToken cancellationToken) =>
        Ok((await catalog.GetCatalogAsync(cancellationToken)).Types);

    [HttpGet("product-types/{code}")]
    public async Task<IActionResult> ProductType(string code, CancellationToken cancellationToken) =>
        TypeOf(await catalog.GetCatalogAsync(cancellationToken), code) is { } type ? Ok(type) : NotFound();

    [HttpPost("product-types")]
    [Authorize(Policy = Permissions.TypesEdit)]
    public async Task<IActionResult> CreateProductType(ProductTypeCreateDto request, CancellationToken cancellationToken)
    {
        var result = await types.CreateAsync(request, cancellationToken);
        return await Saved(result, true, "/api/admin/product-types", view => TypeOf(view, result.Value), cancellationToken);
    }

    [HttpPut("product-types/{code}")]
    [Authorize(Policy = Permissions.TypesEdit)]
    public async Task<IActionResult> UpdateProductType(string code, ProductTypeUpdateDto request, CancellationToken cancellationToken)
    {
        var result = await types.UpdateAsync(code, request, cancellationToken);
        return await Saved(result, false, "/api/admin/product-types", view => TypeOf(view, result.Value), cancellationToken);
    }

    // ---------------------------------------------------------------- Colecciones

    [HttpGet("collections")]
    public async Task<IActionResult> Collections(CancellationToken cancellationToken)
    {
        var all = (await catalog.GetCatalogAsync(cancellationToken)).Collections;
        return IsOwner ? Ok(all.Select(c => c.ToOwner()).ToList()) : Ok(all.Select(c => c.ToOperations()).ToList());
    }

    [HttpGet("collections/{slug}")]
    public async Task<IActionResult> Collection(string slug, CancellationToken cancellationToken)
    {
        var collection = CollectionOf(await catalog.GetCatalogAsync(cancellationToken), slug);
        if (collection is null)
        {
            return NotFound();
        }
        return IsOwner ? Ok(collection.ToOwner()) : Ok(collection.ToOperations());
    }

    [HttpPost("collections")]
    [Authorize(Policy = Permissions.CollectionsEdit)]
    public async Task<IActionResult> CreateCollection(CollectionRequestDto request, CancellationToken cancellationToken)
    {
        var result = await collections.CreateAsync(request, cancellationToken);
        return await Saved(result, true, "/api/admin/collections", view => CollectionOf(view, result.Value)?.ToOwner(), cancellationToken);
    }

    [HttpPut("collections/{slug}")]
    [Authorize(Policy = Permissions.CollectionsEdit)]
    public async Task<IActionResult> UpdateCollection(string slug, CollectionRequestDto request, CancellationToken cancellationToken)
    {
        var result = await collections.UpdateAsync(slug, request, cancellationToken);
        return await Saved(result, false, "/api/admin/collections", view => CollectionOf(view, result.Value)?.ToOwner(), cancellationToken);
    }
}
