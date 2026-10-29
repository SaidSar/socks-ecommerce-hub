using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Sokko.Api.Data;

/// <summary>
/// Todas las fechas se guardan en UTC (DESIGN_DB D-03). Al escribir convierte una hora local a UTC; al leer marca el
/// valor como <see cref="DateTimeKind.Utc"/> para que la API lo serialice con <c>Z</c>.
/// </summary>
public sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    v => v.Kind == DateTimeKind.Local ? v.ToUniversalTime() : v,
    v => DateTime.SpecifyKind(v, DateTimeKind.Utc));
