using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Sesión del panel (DESIGN_ADMIN §4 y §9): solo Dueño y Operaciones.</summary>
[ApiController]
[Route("api/admin/auth")]
public class AdminAuthController(IUserService users, IAuthService auth) : ControllerBase
{
    [HttpPost("login")]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<AdminAuthResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AdminAuthResponseDto>> Login(LoginRequestDto request, CancellationToken cancellationToken)
    {
        var user = await users.ValidateCredentialsAsync(request.Email!, request.Password!, cancellationToken);
        if (user is null)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized, title: AuthLimits.InvalidCredentials);
        }
        if (!Permissions.IsStaff(user.Role))
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Esta cuenta no tiene acceso al panel.");
        }

        var token = auth.IssueToken(user);
        return Ok(new AdminAuthResponseDto(token.Token, token.ExpiresIn, AdminUserDto.From(user)));
    }

    [HttpGet("me")]
    [Authorize(Policy = Permissions.Staff)]
    [ProducesResponseType<AdminMeResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<AdminMeResponseDto>> Me(CancellationToken cancellationToken)
    {
        var user = await users.GetActiveByIdAsync(int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!), cancellationToken);
        return user is null ? Problem(statusCode: StatusCodes.Status401Unauthorized) : Ok(new AdminMeResponseDto(AdminUserDto.From(user)));
    }
}
