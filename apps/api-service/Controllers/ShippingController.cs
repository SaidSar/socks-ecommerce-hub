using Microsoft.AspNetCore.Mvc;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

[ApiController]
[Route("api/shipping")]
public class ShippingController(IQuoteShipping quoteShipping) : ControllerBase
{
    /// <summary>Cotiza el envío por CP y subtotal; 400 con ProblemDetails si el CP es inválido.</summary>
    [HttpPost("quote")]
    [ProducesResponseType<ShippingQuoteDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ShippingQuoteDto>> Quote(ShippingQuoteRequestDto request, CancellationToken cancellationToken) =>
        Ok(await quoteShipping.QuoteAsync(request.PostalCode!, request.Subtotal!.Value, cancellationToken));
}
