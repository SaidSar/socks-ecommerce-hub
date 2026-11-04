using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Bandeja de mensajes de contacto. Dueño y Operaciones (messages.view); la respuesta nunca lleva la IP.</summary>
[Route("api/admin/messages")]
[Authorize(Policy = Permissions.MessagesView)]
public class AdminMessagesController(IContactInboxService inbox, IUserService users) : AdminControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminMessageListDto>> List(
        [FromQuery] string? status, [FromQuery] string? q, [FromQuery] int page = 1, CancellationToken cancellationToken = default)
    {
        var list = await inbox.ListAsync(status, q, page, cancellationToken);
        if (list is null)
        {
            ModelState.AddModelError("status", "El filtro es nuevos, leidos o archivados.");
            return ValidationProblem(ModelState);
        }
        return Ok(list);
    }

    [HttpGet("unread-count")]
    public async Task<ActionResult<AdminUnreadCountDto>> UnreadCount(CancellationToken cancellationToken) =>
        Ok(new AdminUnreadCountDto(await inbox.UnreadCountAsync(cancellationToken)));

    [HttpPost("{id:int}/read")]
    public Task<IActionResult> Read(int id, CancellationToken cancellationToken) => Apply(id, InboxAction.Read, cancellationToken);

    [HttpPost("{id:int}/unread")]
    public Task<IActionResult> Unread(int id, CancellationToken cancellationToken) => Apply(id, InboxAction.Unread, cancellationToken);

    [HttpPost("{id:int}/archive")]
    public Task<IActionResult> Archive(int id, CancellationToken cancellationToken) => Apply(id, InboxAction.Archive, cancellationToken);

    [HttpPost("{id:int}/unarchive")]
    public Task<IActionResult> Unarchive(int id, CancellationToken cancellationToken) => Apply(id, InboxAction.Unarchive, cancellationToken);

    private async Task<IActionResult> Apply(int id, InboxAction action, CancellationToken cancellationToken)
    {
        if (await ActorAsync(users, cancellationToken) is not { } actor)
        {
            return Unauthorized();
        }
        var result = await inbox.ApplyAsync(id, action, actor, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }
}
