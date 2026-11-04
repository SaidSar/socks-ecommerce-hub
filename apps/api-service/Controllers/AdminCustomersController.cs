using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Clientes del panel: con cuenta e invitados. Solo el Dueño (customers.view).</summary>
[Route("api/admin/customers")]
[Authorize(Policy = Permissions.CustomersView)]
public class AdminCustomersController(ICustomerAdminService customers) : AdminControllerBase
{
    private ActionResult InvalidQuery()
    {
        ModelState.AddModelError("type", "Ese filtro u orden no existe.");
        return ValidationProblem(ModelState);
    }

    [HttpGet]
    public async Task<ActionResult<AdminCustomerListDto>> List(
        [FromQuery] string? type, [FromQuery] string? q, [FromQuery] string? sort, [FromQuery] int page = 1, CancellationToken cancellationToken = default)
    {
        var list = await customers.ListAsync(new CustomerQuery(type, q, sort, page), cancellationToken);
        return list is null ? InvalidQuery() : Ok(list);
    }

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminCustomerDetailDto>> Get(int id, CancellationToken cancellationToken)
    {
        var detail = await customers.GetAsync(id, cancellationToken);
        return detail is null ? NotFound() : Ok(detail);
    }

    [HttpGet("guest")]
    public async Task<ActionResult<AdminCustomerDetailDto>> Guest([FromQuery] string? email, CancellationToken cancellationToken)
    {
        var detail = await customers.GetGuestAsync(email, cancellationToken);
        return detail is null ? NotFound() : Ok(detail);
    }

    [HttpGet("export.csv")]
    public async Task<IActionResult> Export([FromQuery] string? type, [FromQuery] string? q, [FromQuery] string? sort, CancellationToken cancellationToken)
    {
        var file = await customers.ExportAsync(new CustomerQuery(type, q, sort), cancellationToken);
        return file is null ? InvalidQuery() : File(file.Content, CsvWriter.ContentType, file.FileName);
    }

    [HttpGet("marketing.csv")]
    public async Task<IActionResult> Marketing(CancellationToken cancellationToken)
    {
        var file = await customers.ExportMarketingAsync(cancellationToken);
        return File(file.Content, CsvWriter.ContentType, file.FileName);
    }
}
