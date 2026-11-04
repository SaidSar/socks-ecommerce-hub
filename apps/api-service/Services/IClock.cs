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
    public DateTime UtcNow => DateTime.UtcNow;

    public DateOnly Today => ToBusinessDate(UtcNow);

    public static DateOnly ToBusinessDate(DateTime utc) => BusinessTime.DateOf(utc);
}

/// <summary>
/// Único lugar que convierte entre UTC (como se guarda todo) y la hora de la tienda: Los Mochis, Sinaloa
/// (<c>America/Mazatlan</c>, UTC−7 sin horario de verano). "Día" y "mes" de los reportes se definen aquí, no en UTC.
/// </summary>
public static class BusinessTime
{
    public const string TimeZoneId = "America/Mazatlan";

    private static readonly TimeZoneInfo Zone = TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);

    /// <summary>Fecha local de un instante UTC.</summary>
    public static DateOnly DateOf(DateTime utc) => DateOnly.FromDateTime(ToLocal(utc));

    /// <summary>Hora local de un instante UTC (para mostrar o exportar).</summary>
    public static DateTime ToLocal(DateTime utc) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), Zone);

    /// <summary>Instante UTC en que empieza el día local <paramref name="day"/> (00:00 en Los Mochis).</summary>
    public static DateTime StartOfDayUtc(DateOnly day) =>
        TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified), Zone);

    /// <summary>Mediodía local de <paramref name="day"/> en UTC: la fecha no cambia al mostrarla en el panel, en ninguna zona de México.</summary>
    public static DateTime NoonUtc(DateOnly day) => StartOfDayUtc(day).AddHours(12);

    /// <summary>Límites UTC <c>[desde, hasta)</c> de los días locales <paramref name="from"/> a <paramref name="to"/>, inclusivos.</summary>
    public static (DateTime FromUtc, DateTime ToUtc) RangeUtc(DateOnly from, DateOnly to) => (StartOfDayUtc(from), StartOfDayUtc(to.AddDays(1)));
}
