using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.InventoryMovements.Queries.GetInventoryMovementStatsQuery;

/// <summary>Contadores del Kardex por rango de fechas para las tarjetas del listado.</summary>
public sealed record InventoryMovementStatsDto
{
    public int Total { get; init; }
    public int Entries { get; init; }
    public int Exits { get; init; }
}

public sealed record GetInventoryMovementStatsQuery(
    Guid TenantId,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null);

public sealed class GetInventoryMovementStatsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<InventoryMovementStatsDto?>> HandleAsync(GetInventoryMovementStatsQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QuerySingleOrDefaultAsync<InventoryMovementStatsDto>(
            connector,
            "[Inventory].[uspGetInventoryMovementStats]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);
    }
}
