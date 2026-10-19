namespace MotelMS.Application.Contracts.Context;

public interface ICurrentUserService
{
    int UserId { get; }
    Guid TenantId { get; }
    Guid? LocationId { get; }
    string Username { get; }
    string Role { get; }
    string TimeZone { get; }
    bool IsAuthenticated { get; }
}
