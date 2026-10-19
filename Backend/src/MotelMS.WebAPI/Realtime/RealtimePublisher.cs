using Microsoft.AspNetCore.SignalR;

namespace MotelMS.WebAPI.Realtime;

/// <summary>Contrato de publicación de eventos en tiempo real hacia las terminales.</summary>
public interface IRealtimePublisher
{
    Task RoomsChangedAsync(Guid tenantId, string reason, object? payload = null);
    Task StayChangedAsync(Guid tenantId, string reason, object payload);
    Task CashChangedAsync(Guid tenantId, string reason, object payload);
    Task InventoryChangedAsync(Guid tenantId, string reason, object payload);
}

/// <summary>Implementación basada en SignalR: emite a los grupos por tenant.</summary>
public sealed class RealtimePublisher(IHubContext<OperationalHub> hub) : IRealtimePublisher
{
    public Task RoomsChangedAsync(Guid tenantId, string reason, object? payload = null)
        => Broadcast(tenantId, "RoomsChanged", new { reason, payload });

    public Task StayChangedAsync(Guid tenantId, string reason, object payload)
        => Broadcast(tenantId, "StayChanged", new { reason, payload });

    public Task CashChangedAsync(Guid tenantId, string reason, object payload)
        => Broadcast(tenantId, "CashChanged", new { reason, payload });

    public Task InventoryChangedAsync(Guid tenantId, string reason, object payload)
        => Broadcast(tenantId, "InventoryChanged", new { reason, payload });

    private Task Broadcast(Guid tenantId, string eventName, object payload)
        => hub.Clients.Group(OperationalHub.TenantGroup(tenantId)).SendAsync(eventName, payload);
}
