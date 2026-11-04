using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.JsonWebTokens;
using Sokko.Api.DTOs;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Favoritos del cliente con sesión. El invitado los guarda en su navegador y los une con <c>merge</c> al entrar.</summary>
[ApiController]
[Route("api/wishlist")]
[Authorize]
public class WishlistController(IWishlistService wishlist) : ControllerBase
{
    private int CurrentUserId => int.Parse(User.FindFirstValue(JwtRegisteredClaimNames.Sub)!);

    [HttpGet]
    [ProducesResponseType<IReadOnlyList<ProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> List(CancellationToken cancellationToken) =>
        Ok(await wishlist.ListAsync(CurrentUserId, cancellationToken));

    [HttpPut("{slug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Add(string slug, CancellationToken cancellationToken) =>
        await wishlist.AddAsync(CurrentUserId, slug, cancellationToken) switch
        {
            WishlistAddResult.Added => NoContent(),
            WishlistAddResult.LimitReached => Problem(statusCode: StatusCodes.Status409Conflict, title: WishlistService.LimitMessage),
            _ => NotFound(),
        };

    [HttpDelete("{slug}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Remove(string slug, CancellationToken cancellationToken)
    {
        await wishlist.RemoveAsync(CurrentUserId, slug, cancellationToken);
        return NoContent();
    }

    [HttpPost("merge")]
    [ProducesResponseType<IReadOnlyList<ProductDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<IReadOnlyList<ProductDto>>> Merge(WishlistMergeRequestDto request, CancellationToken cancellationToken) =>
        Ok(await wishlist.MergeAsync(CurrentUserId, request.Slugs!, cancellationToken));
}
