using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.FineTypes.Queries.GetFineTypesQuery;

public sealed record FineTypeDto
{
    public int FineTypeId { get; init; }
    public Guid TenantId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal DefaultAmount { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedOn { get; init; }
}

/// <summary>Contadores del tenant para las tarjetas de resumen del catálogo de multas.</summary>
public sealed record FineTypeStatsDto(
    int Total,
    int Active,
    int Inactive,
    decimal AverageAmount);

/// <summary>Página del catálogo de tipos de multa: solo la ventana pedida + el total.</summary>
public sealed record FineTypePageDto(
    IReadOnlyList<FineTypeDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    FineTypeStatsDto Stats);

public sealed record GetFineTypesQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetFineTypesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<FineTypePageDto>> HandleAsync(GetFineTypesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@InactiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@AverageAmount", dbType: DbType.Decimal, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<FineTypeDto>(
            connector,
            "[Service].[uspGetFineTypes]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<FineTypePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new FineTypeStatsDto(
            parameters.Get<int?>("@TotalCount") ?? 0,
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@InactiveCount") ?? 0,
            parameters.Get<decimal?>("@AverageAmount") ?? 0m);

        return Result<FineTypePageDto>.Success(
            new FineTypePageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
