using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Inventario del panel (DESIGN_ADMIN §7 y §9). Ajustan los dos roles; importar es solo del Dueño.</summary>
[Route("api/admin/inventory")]
[Authorize(Policy = Permissions.InventoryAdjust)]
public class AdminInventoryController(
    IInventoryAdminService inventory,
    IAdjustInventory adjust,
    IImportInventory import,
    IExportService export,
    IUserService users) : AdminControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? state, [FromQuery] string? q, CancellationToken cancellationToken)
    {
        var list = await inventory.ListAsync(state, q, cancellationToken);
        if (list is null)
        {
            ModelState.AddModelError("state", "Ese filtro no existe.");
            return ValidationProblem(ModelState);
        }
        return Ok(list);
    }

    [HttpGet("{sku}")]
    public async Task<ActionResult<InventoryRowDto>> Get(string sku, CancellationToken cancellationToken)
    {
        var row = await inventory.GetAsync(sku, cancellationToken);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpGet("{sku}/movements")]
    public async Task<ActionResult<IReadOnlyList<InventoryMovementDto>>> Movements(string sku, CancellationToken cancellationToken)
    {
        var movements = await inventory.ListMovementsAsync(sku, cancellationToken);
        return movements is null ? NotFound() : Ok(movements);
    }

    [HttpPost("{sku}/movements")]
    public async Task<IActionResult> AddMovement(string sku, InventoryMovementRequestDto request, CancellationToken cancellationToken)
    {
        if (await ActorAsync(users, cancellationToken) is not { } actor)
        {
            return Unauthorized();
        }
        var result = await adjust.ApplyAsync(new AdjustCommand(sku, request.Type, request.Qty, request.Note, request.Folio, request.RowVersion, actor), cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }

    [HttpGet("import/template")]
    [Authorize(Policy = Permissions.InventoryImport)]
    public async Task<IActionResult> Template(CancellationToken cancellationToken)
    {
        var csv = await export.InventoryTemplateAsync(IsOwner, cancellationToken);
        return File(Encoding.UTF8.GetBytes(csv), "text/csv; charset=utf-8", "plantilla-inventario-sokko.csv");
    }

    [HttpPost("import/preview")]
    [Authorize(Policy = Permissions.InventoryImport)]
    public async Task<ActionResult<ImportPreviewDto>> Preview(InventoryImportRequestDto request, CancellationToken cancellationToken) =>
        Ok(await import.PreviewAsync(request.Csv, IsOwner, cancellationToken));

    [HttpPost("import")]
    [Authorize(Policy = Permissions.InventoryImport)]
    public async Task<IActionResult> Import(InventoryImportRequestDto request, CancellationToken cancellationToken)
    {
        if (await ActorAsync(users, cancellationToken) is not { } actor)
        {
            return Unauthorized();
        }
        return Ok(await import.ApplyAsync(request.Csv, IsOwner, actor, cancellationToken));
    }
}
