using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashBox.Queries.GetCashBoxesQuery;

public sealed record CashBoxDto
{
    public int CashBoxId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed record GetCashBoxesQuery(Guid TenantId);

public sealed class GetCashBoxesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<IEnumerable<CashBoxDto>>> HandleAsync(GetCashBoxesQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QueryAsync<CashBoxDto>(
            connector,
            "[Finance].[uspGetCashBoxes]",
            new { query.TenantId },
            cancellationToken);
    }
}
