using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Pedidos del panel (DESIGN_ADMIN §7 y §9). Los dos roles los surten; los importes solo van al Dueño (R-24).</summary>
[Route("api/admin/orders")]
[Authorize(Policy = Permissions.OrdersManage)]
public class AdminOrdersController(IOrderAdminService orders, IUserService users) : AdminControllerBase
{
    private IActionResult OrderOf(AdminOrderView order) => IsOwner ? Ok(order.ToOwner()) : Ok(order.ToOperations());

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? q, CancellationToken cancellationToken)
    {
        var list = await orders.ListAsync(status, q, cancellationToken);
        if (list is null)
        {
            ModelState.AddModelError("status", "Ese filtro no existe.");
            return ValidationProblem(ModelState);
        }
        return IsOwner ? Ok(list.ToOwner()) : Ok(list.ToOperations());
    }

    [HttpGet("summary")]
    public async Task<ActionResult<AdminOrderSummaryDto>> Summary(CancellationToken cancellationToken) =>
        Ok(await orders.GetSummaryAsync(cancellationToken));

    [HttpGet("couriers")]
    public async Task<ActionResult<IReadOnlyList<string>>> Couriers(CancellationToken cancellationToken) =>
        Ok(await orders.ListCouriersAsync(cancellationToken));

    [HttpGet("{folio}")]
    public async Task<IActionResult> Get(string folio, CancellationToken cancellationToken)
    {
        var order = await orders.GetAsync(folio, cancellationToken);
        return order is null ? NotFound() : OrderOf(order);
    }

    [HttpGet("{folio}/packing-list")]
    public async Task<ActionResult<PackingListDto>> PackingList(string folio, CancellationToken cancellationToken)
    {
        var list = await orders.GetPackingListAsync(folio, cancellationToken);
        return list is null ? NotFound() : Ok(list);
    }

    [HttpPut("{folio}/note")]
    public async Task<IActionResult> Note(string folio, OrderNoteRequestDto request, CancellationToken cancellationToken)
    {
        var result = await orders.SaveNoteAsync(folio, request.Note, request.RowVersion, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? OrderOf(result.Value!) : FailureOf(result);
    }

    [HttpPost("{folio}/payment")]
    [Authorize(Policy = Permissions.PaymentsConfirm)]
    public async Task<IActionResult> Payment(string folio, OrderVersionRequestDto request, CancellationToken cancellationToken)
    {
        if (await ActorAsync(users, cancellationToken) is not { } actor)
        {
            return Unauthorized();
        }
        var result = await orders.MarkPaidAsync(folio, request.RowVersion, actor, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? OrderOf(result.Value!) : FailureOf(result);
    }
}
