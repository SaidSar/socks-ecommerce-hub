using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Configuración del negocio y zonas locales (DESIGN_ADMIN §7). Solo el Dueño.</summary>
[Route("api/admin/settings")]
[Authorize(Policy = Permissions.SettingsManage)]
public class AdminSettingsController(ISettingsService settings) : AdminControllerBase
{
    [HttpGet]
    public async Task<ActionResult<AdminSettingsDto>> Get(CancellationToken cancellationToken) =>
        Ok(await settings.GetAdminAsync(cancellationToken));

    [HttpPut]
    public async Task<IActionResult> Update(AdminSettingsRequestDto request, CancellationToken cancellationToken)
    {
        var userId = int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);
        var result = await settings.SaveAdminAsync(request, userId, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }
}
