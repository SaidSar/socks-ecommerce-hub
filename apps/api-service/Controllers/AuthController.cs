using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Cuenta de la tienda (DESIGN_AUTH §8). El login acepta a cualquier usuario activo (P-01).</summary>
[ApiController]
[Route("api/auth")]
public class AuthController(
    IUserService users,
    IAuthService auth,
    IRegisterCustomer registerCustomer,
    IResetPassword resetPassword) : ControllerBase
{
    public const string WrongCurrentPassword = "La contraseña actual no coincide.";

    private int CurrentUserId => int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    [HttpPost("login")]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<AuthResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> Login(LoginRequestDto request, CancellationToken cancellationToken)
    {
        var user = await users.ValidateCredentialsAsync(request.Email!, request.Password!, cancellationToken);
        return user is null
            ? Problem(statusCode: StatusCodes.Status401Unauthorized, title: AuthLimits.InvalidCredentials)
            : Ok(AuthResponseDto.From(user, auth.IssueToken(user)));
    }

    [HttpPost("register")]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<AuthResponseDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterRequestDto request, CancellationToken cancellationToken)
    {
        var user = await registerCustomer.RegisterAsync(
            new NewCustomer(request.FirstName!, request.LastName!, request.Email!, request.Password!, request.PreferredSize, request.MarketingOptIn),
            cancellationToken);
        return user is null
            ? Problem(statusCode: StatusCodes.Status409Conflict, title: "Este correo ya tiene una cuenta. Inicie sesión o use otro correo.")
            : Created("/api/auth/me", AuthResponseDto.From(user, auth.IssueToken(user)));
    }

    /// <summary>202 siempre: no revela si el correo existe.</summary>
    [HttpPost("forgot-password")]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequestDto request, CancellationToken cancellationToken)
    {
        await resetPassword.RequestAsync(request.Email, cancellationToken);
        return Accepted();
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request, CancellationToken cancellationToken) =>
        await resetPassword.ResetAsync(request.Token!, request.NewPassword!, cancellationToken)
            ? NoContent()
            : Problem(statusCode: StatusCodes.Status400BadRequest, title: "El enlace ya no es válido. Pida uno nuevo.");

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType<MeResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponseDto>> Me(CancellationToken cancellationToken)
    {
        var user = await users.GetActiveByIdAsync(CurrentUserId, cancellationToken);
        return user is null ? Problem(statusCode: StatusCodes.Status401Unauthorized) : Ok(new MeResponseDto(AuthUserDto.From(user)));
    }

    /// <summary>Mi perfil: nombre, talla y boletín. El correo no cambia aquí.</summary>
    [HttpPut("me")]
    [Authorize]
    [ProducesResponseType<MeResponseDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<MeResponseDto>> UpdateMe(UpdateProfileRequestDto request, CancellationToken cancellationToken)
    {
        var user = await users.UpdateProfileAsync(
            CurrentUserId,
            new ProfileUpdate(request.FirstName!, request.LastName!, request.PreferredSize, request.MarketingOptIn),
            cancellationToken);
        return user is null ? Problem(statusCode: StatusCodes.Status401Unauthorized) : Ok(new MeResponseDto(AuthUserDto.From(user)));
    }

    /// <summary>La contraseña actual equivocada responde 400 con el error en <c>CurrentPassword</c>.</summary>
    [HttpPost("change-password")]
    [Authorize]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequestDto request, CancellationToken cancellationToken)
    {
        switch (await users.ChangePasswordAsync(CurrentUserId, request.CurrentPassword!, request.NewPassword!, cancellationToken))
        {
            case PasswordChangeResult.Changed:
                return NoContent();
            case PasswordChangeResult.WrongPassword:
                ModelState.AddModelError(nameof(ChangePasswordRequestDto.CurrentPassword), WrongCurrentPassword);
                return ValidationProblem(ModelState);
            default:
                return Problem(statusCode: StatusCodes.Status401Unauthorized);
        }
    }
}
