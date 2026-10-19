using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.CommissionRules.Queries.GetCommissionRulesQuery;

/// <summary>
/// Regla de comisión con el alcance resuelto: para una regla por empleado trae el nombre del
/// empleado; para una por puesto, el texto del puesto; para una general, «Todos los empleados».
/// </summary>
public sealed record CommissionRuleDto
{
    public int RuleId { get; init; }
    public Guid TenantId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ScopeType { get; init; } = string.Empty;
    public string ScopeTypeName { get; init; } = string.Empty;
    public int? EmployeeId { get; init; }
    public string? EmployeeName { get; init; }
    public string? EmployeePosition { get; init; }
    public string? Position { get; init; }
    public string TargetLabel { get; init; } = string.Empty;
    public string MetricType { get; init; } = string.Empty;
    public string MetricTypeName { get; init; } = string.Empty;
    public decimal MinAmount { get; init; }
    public decimal? MaxAmount { get; init; }
    public decimal RatePercent { get; init; }
    public DateTime StartDate { get; init; }
    public DateTime? EndDate { get; init; }
    public bool IsActive { get; init; }
    public string? Notes { get; init; }
    public DateTime CreatedOn { get; init; }
    public int? CreatedBy { get; init; }
}

/// <summary>Página del catálogo de reglas de comisión: solo la ventana pedida + el total para paginar.</summary>
public sealed record CommissionRulePageDto(
    IReadOnlyList<CommissionRuleDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetCommissionRulesQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    string? ScopeType = null,
    string? MetricType = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetCommissionRulesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CommissionRulePageDto>> HandleAsync(GetCommissionRulesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@OnlyActive", query.OnlyActive);
        parameters.Add("@ScopeType", string.IsNullOrWhiteSpace(query.ScopeType) ? null : query.ScopeType.Trim());
        parameters.Add("@MetricType", string.IsNullOrWhiteSpace(query.MetricType) ? null : query.MetricType.Trim());
        parameters.Add("@RuleId", null);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<CommissionRuleDto>(
            connector,
            "[HR].[uspGetCommissionRules]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<CommissionRulePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<CommissionRulePageDto>.Success(
            new CommissionRulePageDto(result.Value.ToList(), total, page, pageSize));
    }
}
