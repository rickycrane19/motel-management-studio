using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using MotelMS.Application.Contracts.Context;
using MotelMS.Infrastructure.Configuration;

namespace MotelMS.Infrastructure.Security;

public sealed class CurrentUserService(IHttpContextAccessor httpContextAccessor) : ICurrentUserService
{
    private ClaimsPrincipal? User => httpContextAccessor.HttpContext?.User;

    public int UserId
    {
        get
        {
            var claim = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User?.FindFirst("sub")?.Value
                ?? User?.FindFirst("uid")?.Value;
            return int.TryParse(claim, out var id) ? id : 1; // Fallback admin en modo desarrollo/sin auth
        }
    }

    public Guid TenantId
    {
        get
        {
            var claim = User?.FindFirst("tenant_id")?.Value
                ?? User?.FindFirst("TenantId")?.Value;
            return Guid.TryParse(claim, out var id) ? id : Guid.Parse(DatabaseConstants.DefaultTenantId);
        }
    }

    public Guid? LocationId
    {
        get
        {
            var claim = User?.FindFirst("location_id")?.Value
                ?? User?.FindFirst("LocationId")?.Value;
            return Guid.TryParse(claim, out var id) ? id : null;
        }
    }

    public string Username => User?.Identity?.Name
        ?? User?.FindFirst("name")?.Value
        ?? "admin";

    public string Role => User?.FindFirst(ClaimTypes.Role)?.Value
        ?? User?.FindFirst("role")?.Value
        ?? "Admin";

    public string TimeZone => User?.FindFirst("timezone")?.Value ?? DatabaseConstants.TimeZoneId;

    public bool IsAuthenticated => User?.Identity?.IsAuthenticated ?? false;
}
