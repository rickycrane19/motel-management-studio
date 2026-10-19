using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Customers.Queries.GetCustomersQuery;

public sealed record CustomerDto
{
    public int CustomerId { get; init; }
    public string FullName { get; init; } = string.Empty;
    public string? DocumentNumber { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Notes { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedOn { get; init; }
}

/// <summary>Contadores del tenant para las tarjetas del listado de clientes.</summary>
public sealed record CustomerStatsDto(
    int Total,
    int Active,
    int WithContact);

/// <summary>Página del listado de clientes: solo la ventana pedida + el total para paginar.</summary>
public sealed record CustomerPageDto(
    IReadOnlyList<CustomerDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    CustomerStatsDto Stats);

public sealed record GetCustomersQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetCustomersQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CustomerPageDto>> HandleAsync(GetCustomersQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@TotalCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ContactCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<CustomerDto>(
            connector,
            "[Service].[uspGetCustomers]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<CustomerPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new CustomerStatsDto(
            parameters.Get<int?>("@TotalCount") ?? 0,
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@ContactCount") ?? 0);

        return Result<CustomerPageDto>.Success(
            new CustomerPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
