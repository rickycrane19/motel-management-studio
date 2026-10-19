using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeeDeductions.Queries.GetEmployeeDeductionsQuery;

public sealed record EmployeeDeductionDto
{
    public int DeductionId { get; init; }
    public Guid TenantId { get; init; }
    public int EmployeeId { get; init; }
    public string EmployeeName { get; init; } = string.Empty;
    public int? PaymentId { get; init; }
    public string DeductionType { get; init; } = string.Empty;
    public string DeductionTypeName { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public decimal AmountInBase { get; init; }
    public DateTime AppliedOn { get; init; }
    public string? Notes { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
    public int? CreatedBy { get; init; }
}

/// <summary>Página del historial de deducciones aplicadas: la ventana pedida + el total.</summary>
public sealed record EmployeeDeductionPageDto(
    IReadOnlyList<EmployeeDeductionDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetEmployeeDeductionsQuery(
    Guid TenantId,
    int? EmployeeId = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetEmployeeDeductionsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeeDeductionPageDto>> HandleAsync(GetEmployeeDeductionsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<EmployeeDeductionDto>(
            connector,
            "[HR].[uspGetEmployeeDeductions]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<EmployeeDeductionPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<EmployeeDeductionPageDto>.Success(
            new EmployeeDeductionPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
