using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace MotelMS.WebAPI.Realtime;

/// <summary>
/// Hub operativo en tiempo real. Todas las terminales (recepción, POS, caja, etc.)
/// se suscriben al grupo de su tenant/sucursal para recibir eventos de estado:
/// ingreso/salida de clientes, cambios de habitación, movimientos de caja, etc.
/// </summary>
[Authorize]
public sealed class OperationalHub : Hub
{
    public static string TenantGroup(Guid tenantId) => $"tenant:{tenantId:N}";

    public static string LocationGroup(Guid tenantId, Guid locationId)
        => $"tenant:{tenantId:N}:location:{locationId:N}";

    public override async Task OnConnectedAsync()
    {
        var tenantClaim = Context.User?.FindFirst("tenant_id")?.Value;
        if (Guid.TryParse(tenantClaim, out var tenantId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, TenantGroup(tenantId));

            var locationClaim = Context.User?.FindFirst("location_id")?.Value;
            if (Guid.TryParse(locationClaim, out var locationId))
                await Groups.AddToGroupAsync(Context.ConnectionId, LocationGroup(tenantId, locationId));
        }

        await base.OnConnectedAsync();
    }
}
