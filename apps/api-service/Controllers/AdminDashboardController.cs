using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Dashboard del panel (DESIGN_ADMIN §5.5 y DESIGN_CATALOG_UI §4.2). Dueño con pesos y margen; Operaciones sin pesos (R-24).</summary>
[Route("api/admin/dashboard")]
[Authorize(Policy = Permissions.Staff)]
public class AdminDashboardController(IDashboardService dashboard) : AdminControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? range, CancellationToken cancellationToken)
    {
        var view = await dashboard.GetAsync(range, cancellationToken);
        if (view is null)
        {
            ModelState.AddModelError("range", "El rango es hoy, 7d o 30d.");
            return ValidationProblem(ModelState);
        }
        return IsOwner ? Ok(view.ToOwner()) : Ok(view.ToOperations());
    }
}
