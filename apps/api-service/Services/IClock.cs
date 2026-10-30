namespace Sokko.Api.Services;

/// <summary>Utilidad de hora (DESIGN_DB §6.1): la fecha local del negocio decide la temporada (R-28).</summary>
public interface IClock
{
    DateTime UtcNow { get; }

    /// <summary>Fecha de hoy en <c>America/Mazatlan</c>.</summary>
    DateOnly Today { get; }
}

public class SystemClock : IClock
{
    private static readonly TimeZoneInfo BusinessTimeZone = TimeZoneInfo.FindSystemTimeZoneById("America/Mazatlan");

    public DateTime UtcNow => DateTime.UtcNow;

    public DateOnly Today => ToBusinessDate(UtcNow);

    public static DateOnly ToBusinessDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, BusinessTimeZone));
}
