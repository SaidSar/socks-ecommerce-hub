using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Sokko.Api.Models.Enums;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Traduce los resultados de los servicios del panel a respuestas HTTP con <c>ProblemDetails</c>.</summary>
[ApiController]
public abstract class AdminControllerBase : ControllerBase
{
    /// <summary>R-24: el rol elige el DTO, no qué campos se ponen en <c>null</c>.</summary>
    protected bool IsOwner => User.IsInRole(nameof(UserRole.Owner));

    protected IActionResult FailureOf<T>(AdminResult<T> result)
    {
        switch (result.Outcome)
        {
            case AdminOutcome.NotFound:
                return Problem(statusCode: StatusCodes.Status404NotFound, title: result.Message);
            case AdminOutcome.Invalid:
                var modelState = new ModelStateDictionary();
                foreach (var (field, message) in result.Errors!)
                {
                    modelState.AddModelError(field, message);
                }
                return ValidationProblem(modelState);
            default:
                var problem = ProblemDetailsFactory.CreateProblemDetails(HttpContext, StatusCodes.Status409Conflict, result.Message);
                if (result.Errors is not null)
                {
                    problem.Extensions["errors"] = result.Errors;
                }
                return new ObjectResult(problem) { StatusCode = StatusCodes.Status409Conflict };
        }
    }
}
