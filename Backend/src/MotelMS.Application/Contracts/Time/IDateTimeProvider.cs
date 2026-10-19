namespace MotelMS.Application.Contracts.Time;

public interface IDateTimeProvider
{
    DateTime UtcNow { get; }
    DateTime ManaguaNow { get; }
    DateTime ToManaguaTime(DateTime utcDateTime);
    DateTime ToUtc(DateTime localDateTime);
}
