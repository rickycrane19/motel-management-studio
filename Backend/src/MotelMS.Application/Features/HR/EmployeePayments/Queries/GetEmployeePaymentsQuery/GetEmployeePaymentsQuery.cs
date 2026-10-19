using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeePayments.Queries.GetEmployeePaymentsQuery;

public sealed record EmployeePaymentDto
{
    public int PaymentId { get; init; }
    public int EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string PaymentType { get; init; } = string.Empty;
    public DateTime PeriodStart { get; init; }
    public DateTime PeriodEnd { get; init; }
    public decimal UnitsWorked { get; init; }
    public decimal RateApplied { get; init; }
    public decimal BaseAmount { get; init; }
    public decimal BonusAmount { get; init; }
    public decimal DeductionsAmount { get; init; }
    public decimal TotalPaid { get; init; }
    /// <summary>Neto pagado (igual a TotalPaid): base + bono − deducciones.</summary>
    public decimal NetPaid { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public int? PaidFromCashBoxSessionId { get; init; }
    /// <summary>El pago fue un turno extra fuera del contrato vigente.</summary>
    public bool IsExtraShift { get; init; }
    public int? ContractId { get; init; }
    /// <summary>El pago quedó enlazado a un contrato vigente.</summary>
    public bool HasContract { get; init; }
    /// <summary>Número de deducciones detalladas registradas para el pago.</summary>
    public int DeductionsCount { get; init; }
    public string? Notes { get; init; }
    public DateTime PaidAtUtc { get; init; }
    public DateTime? PaidAtManagua { get; init; }
}

/// <summary>Página del historial de pagos: la ventana pedida + el total para paginar.</summary>
public sealed record EmployeePaymentPageDto(
    IReadOnlyList<EmployeePaymentDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetEmployeePaymentsQuery(
    Guid TenantId,
    int? EmployeeId = null,
    DateTime? FromDate = null,
    DateTime? ToDate = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetEmployeePaymentsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeePaymentPageDto>> HandleAsync(GetEmployeePaymentsQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize switch
        {
            < 1 => 20,
            > 200 => 200,
            _ => query.PageSize
        };

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", query.TenantId);
        parameters.Add("@EmployeeId", query.EmployeeId);
        parameters.Add("@FromDate", query.FromDate);
        parameters.Add("@ToDate", query.ToDate);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<EmployeePaymentDto>(
            connector,
            "[HR].[uspGetEmployeePayments]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<EmployeePaymentPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<EmployeePaymentPageDto>.Success(
            new EmployeePaymentPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
