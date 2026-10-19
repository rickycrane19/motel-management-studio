using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetPayrollExpenseReportQuery;

public sealed record PayrollExpenseRowDto
{
    public int EmployeeId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string? ContractPaymentType { get; init; }
    public int PaymentsCount { get; init; }
    public decimal TotalPaid { get; init; }
    /// <summary>Bruto pagado (base + bonos) antes de deducciones.</summary>
    public decimal GrossPaid { get; init; }
    /// <summary>Neto pagado (bruto − deducciones).</summary>
    public decimal NetPaid { get; init; }
    public decimal ContractPaid { get; init; }
    public decimal ExtraPaid { get; init; }
    public int ExtraPayments { get; init; }
    public int ExtraShifts { get; init; }
    public decimal BonusAmount { get; init; }
    public decimal DeductionsAmount { get; init; }
    public decimal InssDeductions { get; init; }
    public decimal IrDeductions { get; init; }
    public decimal LoanDeductions { get; init; }
    public decimal AdvanceDeductions { get; init; }
    public decimal OtherDeductions { get; init; }
    public DateTime? LastPaidAtUtc { get; init; }
}

public sealed record PayrollExpenseReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<PayrollExpenseRowDto> Rows);

public sealed record GetPayrollExpenseReportQuery(Guid TenantId, DateTime FromUtc, DateTime ToUtc);

public sealed class GetPayrollExpenseReportQueryHandler(ISqlConnector connector)
{
    public async Task<Result<PayrollExpenseReport>> HandleAsync(
        GetPayrollExpenseReportQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QueryAsync<PayrollExpenseRowDto>(
            connector,
            "[Finance].[uspGetPayrollExpenseReport]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);

        if (result.IsFailure)
            return Result<PayrollExpenseReport>.Failure(result.Error!);

        return Result<PayrollExpenseReport>.Success(
            new PayrollExpenseReport(query.FromUtc, query.ToUtc, result.Value.ToList()));
    }
}
