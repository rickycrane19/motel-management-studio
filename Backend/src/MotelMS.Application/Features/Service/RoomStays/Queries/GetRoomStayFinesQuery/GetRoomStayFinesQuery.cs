using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Queries.GetRoomStayFinesQuery;

public sealed record RoomStayFineDto
{
    public int FineId { get; init; }
    public int RoomStayId { get; init; }
    public int? FineTypeId { get; init; }
    public string? FineTypeName { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public decimal AmountInBase { get; init; }
    public decimal ExchangeRate { get; init; }
    public bool IsWaived { get; init; }
    public string? WaivedReason { get; init; }
    public DateTime? WaivedAtUtc { get; init; }
    public DateTime? WaivedAtManagua { get; init; }
    public DateTime RecordedAtUtc { get; init; }
    public DateTime? RecordedAtManagua { get; init; }
}

/// <summary>Página de multas de una estancia: solo la ventana pedida + el total para paginar.</summary>
public sealed record RoomStayFinePageDto(
    IReadOnlyList<RoomStayFineDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetRoomStayFinesQuery(
    Guid TenantId,
    int RoomStayId,
    int Page = 1,
    int PageSize = 20);

public sealed class GetRoomStayFinesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<RoomStayFinePageDto>> HandleAsync(GetRoomStayFinesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@RoomStayId", query.RoomStayId);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<RoomStayFineDto>(
            connector,
            "[Service].[uspGetRoomStayFines]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<RoomStayFinePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<RoomStayFinePageDto>.Success(
            new RoomStayFinePageDto(result.Value.ToList(), total, page, pageSize));
    }
}
