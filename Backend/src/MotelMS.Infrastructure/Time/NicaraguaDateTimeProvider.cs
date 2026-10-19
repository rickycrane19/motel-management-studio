using MotelMS.Application.Contracts.Time;

namespace MotelMS.Infrastructure.Time;

public sealed class NicaraguaDateTimeProvider : IDateTimeProvider
{
    private static readonly TimeZoneInfo ManaguaZone = ResolveManaguaTimeZone();

    public DateTime UtcNow => DateTime.UtcNow;

    public DateTime ManaguaNow => TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, ManaguaZone);

    public DateTime ToManaguaTime(DateTime utcDateTime)
    {
        var utc = utcDateTime.Kind switch
        {
            DateTimeKind.Utc => utcDateTime,
            DateTimeKind.Local => utcDateTime.ToUniversalTime(),
            _ => DateTime.SpecifyKind(utcDateTime, DateTimeKind.Utc)
        };
        return TimeZoneInfo.ConvertTimeFromUtc(utc, ManaguaZone);
    }

    public DateTime ToUtc(DateTime localDateTime)
    {
        var unspecified = DateTime.SpecifyKind(localDateTime, DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(unspecified, ManaguaZone);
    }

    private static TimeZoneInfo ResolveManaguaTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("America/Managua");
        }
        catch (TimeZoneNotFoundException)
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById("Central America Standard Time");
            }
            catch
            {
                return TimeZoneInfo.CreateCustomTimeZone("Nicaragua", TimeSpan.FromHours(-6), "Hora estándar de Nicaragua", "Hora estándar de Nicaragua");
            }
        }
    }
}
