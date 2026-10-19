using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Catalogs.Queries.GetRoomTypesQuery;

public sealed record RoomTypeDto(
    int RoomTypeId,
    string Name,
    string? Description,
    decimal BasePrice,
    bool HasGarage,
    bool HasJacuzzi,
    int Capacity,
    bool IsActive);

/// <summary>Página del catálogo de tipos de cuarto: solo la ventana pedida + el total.</summary>
public sealed record RoomTypePageDto(
    IReadOnlyList<RoomTypeDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetRoomTypesQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetRoomTypesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<RoomTypePageDto>> HandleAsync(GetRoomTypesQuery query, CancellationToken cancellationToken = default)
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

        var result = await QueryRunner.QueryAsync<RoomTypeDto>(
            connector,
            "[Service].[uspGetRoomTypes]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<RoomTypePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<RoomTypePageDto>.Success(
            new RoomTypePageDto(result.Value.ToList(), total, page, pageSize));
    }
}
