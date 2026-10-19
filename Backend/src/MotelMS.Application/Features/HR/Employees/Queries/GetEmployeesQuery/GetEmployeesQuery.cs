using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.Employees.Queries.GetEmployeesQuery;

public sealed record EmployeeDto
{
    public int EmployeeId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string Position { get; init; } = string.Empty;
    public string PaymentType { get; init; } = string.Empty;
    public string PaymentTypeName { get; init; } = string.Empty;
    public decimal Rate { get; init; }
    public decimal CommissionRatePercent { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public string? Phone { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedOn { get; init; }
    /// <summary>El empleado tiene un contrato vigente a la fecha de hoy (Managua).</summary>
    public bool HasActiveContract { get; init; }
    /// <summary>Contrato vigente del empleado, si lo tiene.</summary>
    public int? ContractId { get; init; }
    public string? ContractPaymentType { get; init; }
    public decimal? ContractBaseAmount { get; init; }
}

/// <summary>Página del directorio de empleados: la ventana pedida + el total para paginar.</summary>
public sealed record EmployeePageDto(
    IReadOnlyList<EmployeeDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetEmployeesQuery(
    Guid TenantId,
    string? Search = null,
    string? PaymentType = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetEmployeesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeePageDto>> HandleAsync(GetEmployeesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Search", string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim());
        parameters.Add("@PaymentType", string.IsNullOrWhiteSpace(query.PaymentType) ? null : query.PaymentType.Trim());
        parameters.Add("@OnlyActive", query.OnlyActive);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<EmployeeDto>(
            connector,
            "[HR].[uspGetEmployees]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<EmployeePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<EmployeePageDto>.Success(
            new EmployeePageDto(result.Value.ToList(), total, page, pageSize));
    }
}
