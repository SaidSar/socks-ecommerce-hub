using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Sokko.Api.Services;

public enum AdminOutcome
{
    Ok,
    NotFound,
    Invalid,
    Conflict,
}

/// <summary>Resultado de una escritura del panel: el valor, o por qué no se hizo y los errores por campo.</summary>
public record AdminResult<T>(AdminOutcome Outcome, T? Value = default, string? Message = null, IReadOnlyDictionary<string, string>? Errors = null)
{
    public static AdminResult<T> Ok(T value) => new(AdminOutcome.Ok, value);

    public static AdminResult<T> NotFound(string message) => new(AdminOutcome.NotFound, Message: message);

    public static AdminResult<T> Invalid(IReadOnlyDictionary<string, string> errors) => new(AdminOutcome.Invalid, Errors: errors);

    public static AdminResult<T> Conflict(string message, IReadOnlyDictionary<string, string>? errors = null) => new(AdminOutcome.Conflict, Message: message, Errors: errors);
}

/// <summary>
/// R-25: dos personas sobre el mismo registro. El <c>RowVersion</c> viejo, o un índice único que gana otra petición, responden 409
/// con un mensaje para el usuario, nunca 500.
/// </summary>
public class ConcurrencyExceptionFilter(ProblemDetailsFactory problems) : IExceptionFilter
{
    public const string StaleMessage = "Otra persona modificó este registro mientras lo editaba. Recargue la página y vuelva a intentarlo.";

    private const int SqlUniqueIndexViolation = 2601;
    private const int SqlUniqueConstraintViolation = 2627;

    public void OnException(ExceptionContext context)
    {
        var isConflict = context.Exception is DbUpdateConcurrencyException
            || context.Exception is DbUpdateException { InnerException: SqlException { Number: SqlUniqueIndexViolation or SqlUniqueConstraintViolation } };
        if (!isConflict)
        {
            return;
        }

        var problem = problems.CreateProblemDetails(context.HttpContext, StatusCodes.Status409Conflict, StaleMessage);
        context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status409Conflict };
        context.ExceptionHandled = true;
    }
}
