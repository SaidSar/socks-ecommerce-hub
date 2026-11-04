using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>
/// Vista previa del cupón en el checkout (D-40). Anónima y con el límite de <see cref="AuthLimits.Policy"/> para frenar la
/// fuerza bruta de códigos. Usa la misma cotización que <see cref="ICheckoutOrder"/>: lo que ve el cliente es lo que se cobra.
/// </summary>
[ApiController]
[Route("api/coupons")]
public class CouponsController(
    ICouponService coupons,
    IQuoteOrder quoteOrder,
    IInventoryService inventory,
    ICatalogService catalog,
    IClock clock) : ControllerBase
{
    [HttpPost("preview")]
    [AllowAnonymous]
    [EnableRateLimiting(AuthLimits.Policy)]
    [ProducesResponseType<CouponPreviewDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Preview(CouponPreviewRequestDto request, CancellationToken cancellationToken)
    {
        var lines = QuoteOrder.Merge(request.Items!.Select(i => new CheckoutLine(i.Sku!, i.Quantity)));
        var variants = (await inventory.GetForSaleAsync(lines.Select(l => l.Sku).ToList(), cancellationToken))
            .ToDictionary(v => v.Sku, StringComparer.OrdinalIgnoreCase);
        // Un SKU que ya no se vende no suma: el checkout lo reportará como agotado.
        var subtotal = QuoteOrder.BuildItems(lines, variants, catalog, clock.Today).Sum(i => i.Quantity * i.UnitPrice);

        var lookup = await coupons.FindApplicableAsync(request.Code, subtotal, request.Email, forCheckout: false, cancellationToken);
        if (lookup.Rejection is { } rejection)
        {
            var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, StatusCodes.Status422UnprocessableEntity, rejection.Message);
            problem.Extensions["code"] = "coupon_invalid";
            problem.Extensions["reason"] = rejection.Reason;
            problem.Extensions["message"] = rejection.Message;
            return new ObjectResult(problem) { StatusCode = StatusCodes.Status422UnprocessableEntity };
        }

        var coupon = lookup.Coupon!;
        var quote = await quoteOrder.QuoteAsync(subtotal, request.PostalCode, coupon, cancellationToken);
        return Ok(new CouponPreviewDto(
            coupon.Code, coupon.Type, CouponRules.PublicDescription(coupon), quote.Subtotal, quote.Discount, quote.Method, quote.ShippingCost, quote.Total, quote.FreeShippingRemaining));
    }
}

/// <summary>Cupones del panel (sección Promociones). Solo el Dueño (<c>promotions.manage</c>).</summary>
[Route("api/admin/coupons")]
[Authorize(Policy = Permissions.PromotionsManage)]
public class AdminCouponsController(ICouponService coupons) : AdminControllerBase
{
    private IActionResult Result(AdminResult<AdminCouponDto> result) => result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AdminCouponDto>>> List(CancellationToken cancellationToken) =>
        Ok(await coupons.ListAsync(cancellationToken));

    [HttpGet("{id:int}")]
    public async Task<ActionResult<AdminCouponDto>> Get(int id, CancellationToken cancellationToken)
    {
        var coupon = await coupons.GetAsync(id, cancellationToken);
        return coupon is null ? NotFound() : Ok(coupon);
    }

    [HttpPost]
    public async Task<IActionResult> Create(AdminCouponRequestDto request, CancellationToken cancellationToken)
    {
        var result = await coupons.CreateAsync(request, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Created($"/api/admin/coupons/{result.Value!.Id}", result.Value) : FailureOf(result);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, AdminCouponRequestDto request, CancellationToken cancellationToken) =>
        Result(await coupons.UpdateAsync(id, request, cancellationToken));

    [HttpPost("{id:int}/activate")]
    public async Task<IActionResult> Activate(int id, CancellationToken cancellationToken) =>
        Result(await coupons.SetActiveAsync(id, true, cancellationToken));

    [HttpPost("{id:int}/deactivate")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken cancellationToken) =>
        Result(await coupons.SetActiveAsync(id, false, cancellationToken));

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken cancellationToken)
    {
        var result = await coupons.DeleteAsync(id, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? NoContent() : FailureOf(result);
    }
}
