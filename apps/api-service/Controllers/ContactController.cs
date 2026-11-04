using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Formulario de contacto de la tienda (página /contacto).</summary>
[ApiController]
[Route("api/contact")]
public class ContactController(ISubmitContactMessage submitContactMessage) : ControllerBase
{
    /// <summary>202 si el mensaje quedó guardado, aunque el aviso por correo falle (y también si lo descartó el honeypot).</summary>
    [HttpPost]
    [EnableRateLimiting(ContactLimits.Policy)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Post(ContactRequestDto request, CancellationToken cancellationToken)
    {
        await submitContactMessage.SubmitAsync(
            new NewContactMessage(request.Name!, request.Email!, request.Subject!, request.Message!, request.Website, HttpContext.Connection.RemoteIpAddress?.ToString()),
            cancellationToken);
        return Accepted();
    }
}
