namespace MotelMS.Application.Features.Finance.Reports;

/// <summary>
/// Rango del negocio usado por los reportes de Finance. Los reportes NO usan fechas nulas:
/// si el request no manda from/to se asume «mes actual en Managua» (America/Managua, UTC−6,
/// sin horario de verano), y la respuesta SIEMPRE devuelve el rango realmente aplicado para
/// que el UI lo muestre. El rango es [FromUtc, ToUtc), achatando To al inicio del día siguiente
/// cuando el cliente manda fechas día (AAAA-MM-DD) del negocio.
/// </summary>
public static class ReportDateRange
{
    public const string ManaguaTimeZoneId = "America/Managua";

    public static readonly TimeZoneInfo ManaguaTimeZone = ResolveManaguaZone();

    public sealed record ReportRange(DateTime FromUtc, DateTime ToUtc);

    /// <summary>
    /// Resuelve el rango. Fecha sin hora (00:00) = «día del negocio», desde el inicio del día
    /// 'from' hasta el inicio del día siguiente de 'to' en Managua; con hora usa el instante tal cual.
    /// </summary>
    public static ReportRange Resolve(DateTimeOffset? fromUtc, DateTimeOffset? toUtc)
    {
        var from = Normalize(fromUtc?.UtcDateTime, isStart: true);
        var to = Normalize(toUtc?.UtcDateTime, isStart: false, fallback: EndOfCurrentMonthUtc());

        if (to <= from)
            to = EndOfCurrentMonthUtc();

        if (from >= to)
            from = StartOfCurrentMonthUtc();

        return new ReportRange(from, to);
    }

    /// <summary>Día actual del negocio (AAAA-MM-DD) en Managua.</summary>
    public static string CurrentDayKey() => LocalNow().ToString("yyyy-MM-dd");

    public static DateTime StartOfCurrentMonthUtc()
    {
        var nowLocal = LocalNow();
        return ToUtc(new DateTime(nowLocal.Year, nowLocal.Month, 1));
    }

    public static DateTime EndOfCurrentMonthUtc()
    {
        var first = new DateTime(LocalNow().Year, LocalNow().Month, 1);
        return ToUtc(first.AddMonths(1));
    }

    /// <summary>Momento local actual en Managua (wall clock).</summary>
    public static DateTime LocalNow() => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManaguaTimeZone);

    public static DateTime ToUtc(DateTime localWallClock)
        => TimeZoneInfo.ConvertTimeToUtc(DateTime.SpecifyKind(localWallClock, DateTimeKind.Unspecified), ManaguaTimeZone);

    private static DateTime Normalize(DateTime? utc, bool isStart, DateTime? fallback = null)
    {
        if (utc is null)
            return fallback ?? StartOfCurrentMonthUtc();

        var value = utc.Value;

        // Fecha día del negocio (00:00): se interpreta como día Managua, no como instante UTC.
        if (value.TimeOfDay == TimeSpan.Zero && value.Kind is DateTimeKind.Utc or DateTimeKind.Unspecified)
        {
            if (isStart)
                return StartOfDayUtc(value.Date);
            return StartOfDayUtc(value.Date.AddDays(1));
        }

        return value.Kind == DateTimeKind.Unspecified
            ? value
            : value.ToUniversalTime();
    }

    /// <summary>Instante UTC en que comienza el día (AAAA-MM-DD o con hora ignorada) en Managua.</summary>
    public static DateTime StartOfDayUtc(DateTime day)
    {
        var localStart = new DateTime(day.Year, day.Month, day.Day);
        return ToUtc(localStart);
    }

    private static TimeZoneInfo ResolveManaguaZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(ManaguaTimeZoneId);
        }
        catch (Exception)
        {
            // Clave IANA no disponible: Nicaragua es UTC−6 fijo (sin horario de verano).
            return TimeZoneInfo.CreateCustomTimeZone("Managua", new TimeSpan(-6, 0, 0), ManaguaTimeZoneId, ManaguaTimeZoneId);
        }
    }
}
