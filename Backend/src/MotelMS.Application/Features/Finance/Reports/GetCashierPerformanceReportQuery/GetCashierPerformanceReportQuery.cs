using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetCashierPerformanceReportQuery;

/// <summary>
/// Fila del reporte de rendimiento por cajero. La fila TOTAL del SP llega con UserId = 0 y
/// UserName = 'TOTAL' (CommissionRatePercent nulo); el UI la usa para los totales del período.
/// </summary>
public sealed record CashierPerformanceRowDto
{
    public int UserId { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string UserFullName { get; init; } = string.Empty;
    public string? Role { get; init; }
    public int SessionsCount { get; init; }
    public int OpenSessionsCount { get; init; }
    public decimal HoursOnShift { get; init; }
    public int StaysCount { get; init; }
    public decimal StaysRevenue { get; init; }
    public decimal ProductsRevenue { get; init; }
    public decimal FinesRevenue { get; init; }
    public decimal SalesCollected { get; init; }
    public decimal AvgTicket { get; init; }
    public decimal AdjustmentsInBase { get; init; }
    public decimal AdjustmentsOutBase { get; init; }
    public decimal TipsInBase { get; init; }
    public int TiesCount { get; init; }
    public string? CommissionRuleName { get; init; }
    public string? CommissionMetricType { get; init; }
    public decimal CommissionRatePercent { get; init; }
    public decimal CommissionAmount { get; init; }
    public decimal DifferenceBase { get; init; }
    public DateTime FromManagua { get; init; }
    public DateTime ToManagua { get; init; }
}

public sealed record CashierPerformanceReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<CashierPerformanceRowDto> Rows);

public sealed record GetCashierPerformanceReportQuery(Guid TenantId, DateTime FromUtc, DateTime ToUtc, int? UserId = null);

public sealed class GetCashierPerformanceReportQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CashierPerformanceReport>> HandleAsync(
        GetCashierPerformanceReportQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QueryAsync<CashierPerformanceRowDto>(
            connector,
            "[Finance].[uspGetCashierPerformanceReport]",
            new { query.TenantId, query.FromUtc, query.ToUtc, query.UserId },
            cancellationToken);

        if (result.IsFailure)
            return Result<CashierPerformanceReport>.Failure(result.Error!);

        return Result<CashierPerformanceReport>.Success(
            new CashierPerformanceReport(query.FromUtc, query.ToUtc, result.Value.ToList()));
    }
}
