using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Rooms.Queries.GetRoomsQuery;

/// <summary>Contadores del tenant para las tarjetas de resumen del listado de habitaciones.</summary>
public sealed record RoomStatsDto(
    int Active,
    int Inactive,
    int Available,
    int Occupied);

/// <summary>Página del listado de habitaciones: solo la ventana pedida + el total para paginar.</summary>
public sealed record RoomPageDto(
    IReadOnlyList<RoomDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    RoomStatsDto Stats);

public sealed record GetRoomsQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    bool IncludeInactive = false,
    int? RoomTypeId = null,
    int? FloorNumber = null,
    byte? StatusCode = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetRoomsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<RoomPageDto>> HandleAsync(GetRoomsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@IncludeInactive", query.IncludeInactive);
        parameters.Add("@RoomTypeId", query.RoomTypeId);
        parameters.Add("@FloorNumber", query.FloorNumber);
        parameters.Add("@StatusCode", query.StatusCode);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@InactiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@AvailableCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@OccupiedCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<RoomDto>(
            connector,
            "[Service].[uspGetRooms]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<RoomPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new RoomStatsDto(
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@InactiveCount") ?? 0,
            parameters.Get<int?>("@AvailableCount") ?? 0,
            parameters.Get<int?>("@OccupiedCount") ?? 0);

        return Result<RoomPageDto>.Success(
            new RoomPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
