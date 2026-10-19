using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Queries.GetRoomStayDetailQuery;

public sealed record RoomStayDetailDto
{
    public RoomStayHeaderDto? Header { get; set; }
    public RoomStayHeaderDto? Stay => Header;
    public List<RoomStayConsumptionItemDto> Consumptions { get; set; } = [];
    public List<RoomStayExtensionItemDto> Extensions { get; set; } = [];
    public List<RoomStayFineItemDto> Fines { get; set; } = [];
}

public sealed record RoomStayHeaderDto
{
    public int RoomStayId { get; init; }
    public int RoomId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public string RoomTypeName { get; init; } = string.Empty;
    public int? CustomerId { get; init; }
    public string CustomerName { get; init; } = string.Empty;
    public byte ArrivalType { get; init; }
    public string ArrivalTypeName { get; init; } = string.Empty;
    public string? VehiclePlate { get; init; }
    public int ServiceStayTypeId { get; init; }
    public string ServiceStayTypeName { get; init; } = string.Empty;
    public decimal BaseServiceCost { get; init; }
    public DateTime StartTimeUtc { get; init; }
    public DateTime ExpectedEndTimeUtc { get; init; }
    public DateTime? ActualEndTimeUtc { get; init; }
    public DateTime? StartTimeManagua { get; init; }
    public DateTime? ExpectedEndTimeManagua { get; init; }
    public byte StatusCode { get; init; }
    public decimal ExtendedHours { get; init; }
    public decimal ExtensionCost { get; init; }
    public decimal ProductsTotal { get; init; }
    public decimal FinesTotal { get; init; }
    public decimal TotalAmount { get; init; }
    public decimal PaidAmount { get; init; }
    public bool IsPaid { get; init; }
    public string? PaymentMethod { get; init; }
    public string? Notes { get; init; }
}

public sealed record RoomStayConsumptionItemDto
{
    public int ConsumptionId { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductCode { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal SubTotal { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

public sealed record RoomStayExtensionItemDto
{
    public int ExtensionId { get; init; }
    public int ServiceStayTypeId { get; init; }
    public string ServiceStayTypeName { get; init; } = string.Empty;
    public decimal ExtraHours { get; init; }
    public decimal Cost { get; init; }
    public DateTime NewExpectedEndTimeUtc { get; init; }
    public DateTime? NewExpectedEndTimeManagua { get; init; }
    public DateTime CreatedOnUtc { get; init; }
}

public sealed record RoomStayFineItemDto
{
    public int FineId { get; init; }
    public int? FineTypeId { get; init; }
    public string? FineTypeName { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public decimal AmountInBase { get; init; }
    public bool IsWaived { get; init; }
    public string? WaivedReason { get; init; }
    public DateTime? RecordedAtManagua { get; init; }
}

public sealed record GetRoomStayDetailQuery(Guid TenantId, int RoomStayId);

public sealed class GetRoomStayDetailQueryHandler(ISqlConnector connector)
{
    public async Task<Result<RoomStayDetailDto>> HandleAsync(GetRoomStayDetailQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var multi = await connector.QueryMultipleAsync(
                "[Service].[uspGetRoomStayDetail]",
                new { query.TenantId, query.RoomStayId },
                cancellationToken);

            var header = await multi.ReadSingleOrDefaultAsync<RoomStayHeaderDto>();
            if (header is null)
                return Result<RoomStayDetailDto>.Failure(Error.NotFound("La estancia no fue encontrada."));

            var consumptions = (await multi.ReadAsync<RoomStayConsumptionItemDto>()).ToList();
            var extensions = (await multi.ReadAsync<RoomStayExtensionItemDto>()).ToList();
            var fines = (await multi.ReadAsync<RoomStayFineItemDto>()).ToList();

            var dto = new RoomStayDetailDto
            {
                Header = header,
                Consumptions = consumptions,
                Extensions = extensions,
                Fines = fines
            };

            return Result<RoomStayDetailDto>.Success(dto);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            return Common.Data.SqlExceptionMapper.MapToResult<RoomStayDetailDto>(ex);
        }
    }
}
