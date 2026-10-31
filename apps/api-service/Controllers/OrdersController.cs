using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Models;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Compra y consulta de pedidos (DESIGN_CHECKOUT §6). Sirve a invitados y a clientes con sesión.</summary>
[ApiController]
[Route("api/orders")]
public class OrdersController(
    ICheckoutOrder checkout,
    IOrderService orders,
    IUserService users,
    IExpireOxxoOrders expiry,
    IUnitOfWork unitOfWork,
    IClock clock,
    IHostEnvironment environment) : ControllerBase
{
    private const int MineLimit = 50;

    private int? CurrentUserId => User.Identity?.IsAuthenticated == true
        ? int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!)
        : null;

    /// <summary>Quien manda un token vencido no compra como invitado por accidente: su sesión se cierra.</summary>
    private bool HasInvalidBearer => Request.Headers.Authorization.Count > 0 && CurrentUserId is null;

    [HttpPost]
    [AllowAnonymous]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Create(
        OrderRequestDto request,
        [FromHeader(Name = "Idempotency-Key")]
        [RegularExpression(@"^[\x21-\x7E]{1,64}$", ErrorMessage = "La llave de idempotencia no es válida.")]
        string? idempotencyKey,
        CancellationToken cancellationToken)
    {
        if (HasInvalidBearer || (CurrentUserId is { } id && await users.GetActiveByIdAsync(id, cancellationToken) is null))
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized);
        }

        switch (await checkout.PlaceAsync(request.ToCommand(CurrentUserId, idempotencyKey), cancellationToken))
        {
            case CheckoutResult.Created created:
                if (created.Replayed)
                {
                    Response.Headers["Idempotency-Replayed"] = "true";
                }
                var order = await orders.FindByFolioAsync(created.Folio, cancellationToken);
                return Created($"/api/orders/{created.Folio}", ToDto(order!));

            case CheckoutResult.OutOfStock outOfStock:
                return ProblemWith(StatusCodes.Status409Conflict, "No hay existencias suficientes.", new()
                {
                    ["code"] = "out_of_stock",
                    ["lines"] = outOfStock.Lines
                        .Select(l => new { l.Sku, l.Requested, l.Available, Message = $"No hay pares suficientes de {l.Sku}" })
                        .ToList(),
                });

            case CheckoutResult.PriceChanged changed:
                return ProblemWith(StatusCodes.Status409Conflict, "El total del pedido cambió.", new()
                {
                    ["code"] = "price_changed",
                    ["total"] = changed.Total,
                });

            case CheckoutResult.Declined declined:
                return ProblemWith(
                    StatusCodes.Status402PaymentRequired,
                    declined.Code == PaymentDecline.InsufficientFunds
                        ? "La tarjeta no tiene fondos suficientes. Pruebe con otra o elija OXXO Pay."
                        : "Su banco rechazó la tarjeta. Pruebe con otra o elija OXXO Pay.",
                    new() { ["declineCode"] = declined.Code });

            default:
                return Problem(statusCode: StatusCodes.Status422UnprocessableEntity, title: "Esta llave ya se usó con otros datos.");
        }
    }

    [HttpGet("mine")]
    [Authorize]
    [ProducesResponseType<IReadOnlyList<OrderDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<OrderDto>>> Mine(CancellationToken cancellationToken)
    {
        var mine = await orders.ListByUserAsync(CurrentUserId!.Value, MineLimit, cancellationToken);
        return Ok(mine.Select(ToDto).ToList());
    }

    /// <summary>Su dueño con Bearer, o un invitado con el correo en <c>X-Customer-Email</c>. Un folio ajeno responde igual que uno inexistente.</summary>
    [HttpGet("{folio}")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Get(string folio, [FromHeader(Name = "X-Customer-Email")] string? email, CancellationToken cancellationToken)
    {
        if (HasInvalidBearer)
        {
            return Problem(statusCode: StatusCodes.Status401Unauthorized);
        }

        var order = await orders.FindByFolioAsync(folio, cancellationToken);
        return order is not null && CanRead(order, email) ? Ok(ToDto(order)) : NotFound();
    }

    /// <summary>Solo en Development, para demostrar el pago en tienda.</summary>
    [HttpPost("{folio}/oxxo/simulate-payment")]
    [AllowAnonymous]
    [ProducesResponseType<OrderDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> SimulateOxxoPayment(string folio, [FromHeader(Name = "X-Customer-Email")] string? email, CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment())
        {
            return NotFound();
        }

        var order = await orders.FindByFolioAsync(folio, cancellationToken);
        if (order is null || !CanRead(order, email))
        {
            return NotFound();
        }

        var paid = await unitOfWork.InTransactionAsync(async ct =>
        {
            var confirmed = await orders.ConfirmOxxoPaymentAsync(folio, clock.UtcNow, ct);
            return (confirmed, confirmed);
        }, cancellationToken);
        if (!paid)
        {
            return Problem(statusCode: StatusCodes.Status409Conflict, title: "Este pedido no tiene un pago OXXO pendiente.");
        }
        return Ok(ToDto((await orders.FindByFolioAsync(folio, cancellationToken))!));
    }

    private bool CanRead(Order order, string? email) =>
        order.UserId is { } ownerId
            ? ownerId == CurrentUserId
            : !string.IsNullOrWhiteSpace(email) && UserService.NormalizeEmail(email) == order.CustomerEmail;

    private OrderDto ToDto(Order order) => OrderDto.From(order, expiry.Lifetime);

    private ObjectResult ProblemWith(int status, string title, Dictionary<string, object?> extensions)
    {
        var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, status, title);
        foreach (var (key, value) in extensions)
        {
            problem.Extensions[key] = value;
        }
        return new ObjectResult(problem) { StatusCode = status };
    }
}
