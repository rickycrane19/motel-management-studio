using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Products.Queries.GetProductStatsQuery;

/// <summary>Contadores del catálogo para las tarjetas del listado (sin traer las filas).</summary>
public sealed record ProductStatsDto
{
    public int Total { get; init; }
    public int Active { get; init; }
    public int Inactive { get; init; }
    public int LowStock { get; init; }
}

public sealed record GetProductStatsQuery(Guid TenantId);

public sealed class GetProductStatsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ProductStatsDto?>> HandleAsync(GetProductStatsQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QuerySingleOrDefaultAsync<ProductStatsDto>(
            connector,
            "[Inventory].[uspGetProductStats]",
            new { query.TenantId },
            cancellationToken);
    }
}
