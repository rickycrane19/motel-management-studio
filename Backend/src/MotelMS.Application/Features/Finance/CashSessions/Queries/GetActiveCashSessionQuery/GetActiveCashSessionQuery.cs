using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashSessions.Queries.GetActiveCashSessionQuery;

public sealed record ActiveCashSessionDto
{
    public int CashBoxSessionId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public int CashBoxId { get; init; }
    public string CashBoxName { get; init; } = string.Empty;
    public int UserId { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public DateTime OpenedAtUtc { get; init; }
    public DateTime? OpenedAtManagua { get; init; }
    public byte StatusCode { get; init; }
    public decimal OpeningBalanceBase { get; init; }
    public decimal TotalSalesBase { get; init; }
    public decimal TotalInAdjustmentsBase { get; init; }
    public decimal TotalOutAdjustmentsBase { get; init; }
    public decimal CurrentCalculatedBase { get; init; }
    public string? Notes { get; init; }
}

public sealed record GetActiveCashSessionQuery(Guid TenantId, int? UserId = null, int? CashBoxId = null);

public sealed class GetActiveCashSessionQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ActiveCashSessionDto?>> HandleAsync(GetActiveCashSessionQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QuerySingleOrDefaultAsync<ActiveCashSessionDto>(
            connector,
            "[Finance].[uspGetActiveCashSession]",
            new { query.TenantId, query.UserId, query.CashBoxId },
            cancellationToken);
    }
}
