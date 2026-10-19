using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetFinancialSummaryQuery;

public sealed record FinancialSummaryDto
{
    public int ClosedStays { get; init; }

    public decimal RevenueStays { get; init; }
    public decimal RevenueProducts { get; init; }
    public decimal RevenueFines { get; init; }

    public decimal ExpensePurchases { get; init; }
    public decimal RecoverySupplierReturns { get; init; }
    public decimal ExpenseCustomerReturns { get; init; }
    public decimal ExpensePayroll { get; init; }
    public decimal ExpenseLosses { get; init; }

    public decimal ExpenseManualAdjustments { get; init; }
    public decimal OtherIncomeManualAdjustments { get; init; }
}

/// <summary>Envelope común de reportes: incluye el rango real aplicado (con defaults de Managua).</summary>
public sealed record FinanceReportEnvelope<T>(DateTime FromUtc, DateTime ToUtc, T Data);

public sealed record GetFinancialSummaryQuery(Guid TenantId, DateTime FromUtc, DateTime ToUtc);

public sealed class GetFinancialSummaryQueryHandler(ISqlConnector connector)
{
    public async Task<Result<FinanceReportEnvelope<FinancialSummaryDto>>> HandleAsync(
        GetFinancialSummaryQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QuerySingleOrDefaultAsync<FinancialSummaryDto>(
            connector,
            "[Finance].[uspGetFinancialSummary]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);

        if (result.IsFailure)
            return Result<FinanceReportEnvelope<FinancialSummaryDto>>.Failure(result.Error!);

        return Result<FinanceReportEnvelope<FinancialSummaryDto>>.Success(
            new FinanceReportEnvelope<FinancialSummaryDto>(query.FromUtc, query.ToUtc, result.Value ?? new FinancialSummaryDto()));
    }
}
