using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeeContracts.Queries.GetEmployeeContractsQuery;

public sealed record EmployeeContractDto
{
    public int ContractId { get; init; }
    public Guid TenantId { get; init; }
    public int EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public string? EmployeePosition { get; init; }
    public string Position { get; init; } = string.Empty;
    public string PaymentType { get; init; } = string.Empty;
    public string PaymentTypeName { get; init; } = string.Empty;
    public decimal BaseAmount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public DateTime StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public bool IsActive { get; init; }
    public int? DaysToEnd { get; init; }
    public string? ScheduleNotes { get; init; }
    public string? Notes { get; init; }
    public DateTime CreatedOn { get; init; }
    public int? CreatedBy { get; init; }
}

/// <summary>Contadores del tenant para las tarjetas de resumen de contratos.</summary>
public sealed record EmployeeContractStatsDto(
    int Active,
    int Expiring,
    int Expired,
    int Ended);

/// <summary>Página del histórico de contratos: solo la ventana pedida + el total para paginar.</summary>
public sealed record EmployeeContractPageDto(
    IReadOnlyList<EmployeeContractDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    EmployeeContractStatsDto Stats);

public sealed record GetEmployeeContractsQuery(
    Guid TenantId,
    int? EmployeeId = null,
    bool? Active = null,
    string? Search = null,
    string? PaymentType = null,
    string? Status = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetEmployeeContractsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeeContractPageDto>> HandleAsync(GetEmployeeContractsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Active", query.Active);
        parameters.Add("@Search", string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim());
        parameters.Add("@PaymentType", string.IsNullOrWhiteSpace(query.PaymentType) ? null : query.PaymentType.Trim());
        parameters.Add("@Status", string.IsNullOrWhiteSpace(query.Status) ? null : query.Status.Trim());
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ExpiringCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ExpiredCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@EndedCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<EmployeeContractDto>(
            connector,
            "[HR].[uspGetEmployeeContracts]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<EmployeeContractPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new EmployeeContractStatsDto(
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@ExpiringCount") ?? 0,
            parameters.Get<int?>("@ExpiredCount") ?? 0,
            parameters.Get<int?>("@EndedCount") ?? 0);

        return Result<EmployeeContractPageDto>.Success(
            new EmployeeContractPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
