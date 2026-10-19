using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Reservations.Queries.GetRoomReservationsQuery;

public sealed record RoomReservationDto
{
    public int ReservationId { get; init; }
    public int RoomId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public string RoomTypeName { get; init; } = string.Empty;
    public string CustomerName { get; init; } = string.Empty;
    public string? Phone { get; init; }
    public int ServiceStayTypeId { get; init; }
    public string ServiceStayTypeName { get; init; } = string.Empty;
    public DateTime ReservationStartUtc { get; init; }
    public DateTime ReservationEndUtc { get; init; }
    public DateTime? ReservationStartManagua { get; init; }
    public DateTime? ReservationEndManagua { get; init; }
    public decimal DepositAmount { get; init; }
    public byte StatusCode { get; init; }
    public string StatusName { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

/// <summary>Contadores del tenant para las tarjetas del listado de reservaciones.</summary>
public sealed record RoomReservationStatsDto(
    int Confirmed,
    int Today,
    int Cancelled,
    int NoShow);

/// <summary>Página del listado de reservaciones: solo la ventana pedida + el total para paginar.</summary>
public sealed record RoomReservationPageDto(
    IReadOnlyList<RoomReservationDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    RoomReservationStatsDto Stats);

public sealed record GetRoomReservationsQuery(
    Guid TenantId,
    string? Search = null,
    byte? Status = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetRoomReservationsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<RoomReservationPageDto>> HandleAsync(GetRoomReservationsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Status", query.Status);
        parameters.Add("@FromUtc", query.FromUtc);
        parameters.Add("@ToUtc", query.ToUtc);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ConfirmedCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@TodayCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@CancelledCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@NoShowCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<RoomReservationDto>(
            connector,
            "[Service].[uspGetRoomReservations]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<RoomReservationPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new RoomReservationStatsDto(
            parameters.Get<int?>("@ConfirmedCount") ?? 0,
            parameters.Get<int?>("@TodayCount") ?? 0,
            parameters.Get<int?>("@CancelledCount") ?? 0,
            parameters.Get<int?>("@NoShowCount") ?? 0);

        // datetime2 se materializa sin Kind: se marca UTC para que el JSON viaje con "Z"
        // y el frontend lo proyecte a America/Managua sin depender de la zona del navegador.
        var items = result.Value
            .Select(item => item with
            {
                ReservationStartUtc = DateTime.SpecifyKind(item.ReservationStartUtc, DateTimeKind.Utc),
                ReservationEndUtc = DateTime.SpecifyKind(item.ReservationEndUtc, DateTimeKind.Utc)
            })
            .ToList();

        return Result<RoomReservationPageDto>.Success(
            new RoomReservationPageDto(items, total, page, pageSize, stats));
    }
}
