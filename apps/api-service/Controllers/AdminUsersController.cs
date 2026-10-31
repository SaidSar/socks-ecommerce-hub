using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Usuarios internos (DESIGN_ADMIN §7 y §9). Solo el Dueño da de alta.</summary>
[Route("api/admin/users")]
[Authorize(Policy = Permissions.SettingsManage)]
public class AdminUsersController(IUserService users, IInviteUser inviteUser) : AdminControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminUserDto>>> List(CancellationToken cancellationToken) =>
        Ok((await users.ListInternalAsync(cancellationToken)).Select(AdminUserDto.From).ToList());

    [HttpPost("invitations")]
    public async Task<IActionResult> Invite(UserInvitationRequestDto request, CancellationToken cancellationToken)
    {
        var role = request.Role == "dueno" ? UserRole.Owner : UserRole.Operations;
        var user = await inviteUser.InviteAsync(request.FirstName!, request.LastName!, request.Email!, role, cancellationToken);
        if (user is null)
        {
            const string taken = "Este correo ya tiene una cuenta.";
            return FailureOf(AdminResult<string>.Conflict(taken, new Dictionary<string, string> { ["email"] = taken }));
        }
        return Created("/api/admin/users", AdminUserDto.From(user));
    }
}
