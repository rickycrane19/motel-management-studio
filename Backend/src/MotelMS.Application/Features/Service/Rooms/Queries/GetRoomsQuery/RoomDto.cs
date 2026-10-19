namespace MotelMS.Application.Features.Service.Rooms.Queries.GetRoomsQuery;

public sealed record RoomDto
{
    public int RoomId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string RoomNumber { get; init; } = string.Empty;
    public int RoomTypeId { get; init; }
    public string RoomTypeName { get; init; } = string.Empty;
    public bool HasGarage { get; init; }
    public bool HasJacuzzi { get; init; }
    public int Capacity { get; init; }
    public byte StatusCode { get; init; }
    public string StatusName { get; init; } = string.Empty;
    public int FloorNumber { get; init; }
    public string? Notes { get; init; }
    public bool IsActive { get; init; }
    public int? CurrentRoomStayId { get; init; }

    // Datos estancia activa
    public int? CustomerId { get; init; }
    public string? CustomerName { get; init; }
    public byte? ArrivalType { get; init; }
    public string? ArrivalTypeName { get; init; }
    public string? VehiclePlate { get; init; }
    public int? ServiceStayTypeId { get; init; }
    public string? ServiceStayTypeName { get; init; }
    public decimal? BaseServiceCost { get; init; }
    public DateTime? StartTimeUtc { get; init; }
    public DateTime? ExpectedEndTimeUtc { get; init; }
    public DateTime? StartTimeManagua { get; init; }
    public DateTime? ExpectedEndTimeManagua { get; init; }
    public decimal? ExtendedHours { get; init; }
    public decimal? ExtensionCost { get; init; }
    public decimal? ProductsTotal { get; init; }
    public decimal? FinesTotal { get; init; }
    public decimal? TotalAmount { get; init; }
    public int? ElapsedMinutes { get; init; }
    public int? RemainingMinutes { get; init; }
    public int IsExpiringSoon { get; init; }
}
