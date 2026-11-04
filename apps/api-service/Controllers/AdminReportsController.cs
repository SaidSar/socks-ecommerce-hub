using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Sokko.Api.Services;

namespace Sokko.Api.Controllers;

/// <summary>Reportes de ventas (sección Reportes). Solo el Dueño: Operaciones nunca ve pesos (R-24, DECISIONES_ADMIN).</summary>
[Route("api/admin/reports")]
[Authorize(Policy = Permissions.FinanceView)]
public class AdminReportsController(IReportService reports) : AdminControllerBase
{
    /// <summary><c>from</c> y <c>to</c>: fechas locales <c>YYYY-MM-DD</c>, inclusivas, máximo 366 días.</summary>
    [HttpGet("sales")]
    public async Task<IActionResult> Sales([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken)
    {
        var result = await reports.GetSalesAsync(from, to, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? Ok(result.Value) : FailureOf(result);
    }

    [HttpGet("sales.csv")]
    public async Task<IActionResult> SalesCsv([FromQuery] string? from, [FromQuery] string? to, CancellationToken cancellationToken)
    {
        var result = await reports.GetSalesCsvAsync(from, to, cancellationToken);
        return result.Outcome == AdminOutcome.Ok ? File(result.Value!.Content, CsvWriter.ContentType, result.Value.FileName) : FailureOf(result);
    }
}
