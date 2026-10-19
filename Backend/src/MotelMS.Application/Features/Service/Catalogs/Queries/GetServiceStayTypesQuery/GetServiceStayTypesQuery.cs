using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Catalogs.Queries.GetServiceStayTypesQuery;

public sealed record ServiceStayTypeDto(
    int ServiceStayTypeId,
    int? RoomTypeId,
    string? RoomTypeName,
    string Name,
    decimal DurationHours,
    decimal Price,
    bool IsExtension,
    bool IsActive);

/// <summary>Contadores del tenant para las tarjetas de resumen del catálogo de tarifas.</summary>
public sealed record ServiceStayTypeStatsDto(
    int Total,
    int Active,
    int Inactive,
    int Extensions);

/// <summary>Página del catálogo de tarifas de estancia: solo la ventana pedida + el total.</summary>
public sealed record ServiceStayTypePageDto(
    IReadOnlyList<ServiceStayTypeDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    ServiceStayTypeStatsDto Stats);

public sealed record GetServiceStayTypesQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    bool? IsExtension = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetServiceStayTypesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ServiceStayTypePageDto>> HandleAsync(GetServiceStayTypesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@IsExtension", query.IsExtension);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@TotalCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@InactiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ExtensionCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<ServiceStayTypeDto>(
            connector,
            "[Service].[uspGetServiceStayTypes]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<ServiceStayTypePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new ServiceStayTypeStatsDto(
            parameters.Get<int?>("@TotalCount") ?? 0,
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@InactiveCount") ?? 0,
            parameters.Get<int?>("@ExtensionCount") ?? 0);

        return Result<ServiceStayTypePageDto>.Success(
            new ServiceStayTypePageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
