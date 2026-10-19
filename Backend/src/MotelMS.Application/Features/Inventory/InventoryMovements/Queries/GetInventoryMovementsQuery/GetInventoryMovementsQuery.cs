using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.InventoryMovements.Queries.GetInventoryMovementsQuery;

public sealed record InventoryMovementDto
{
    public int MovementId { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductCode { get; init; } = string.Empty;
    public string MovementType { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal PreviousStock { get; init; }
    public decimal NewStock { get; init; }
    public decimal UnitCost { get; init; }
    public decimal TotalCost { get; init; }
    public string? Reason { get; init; }
    public string? ReferenceDoc { get; init; }
    public int? RoomStayId { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

/// <summary>Página del Kardex: solo la ventana pedida + el total para paginar en la UI.</summary>
public sealed record InventoryMovementPageDto(
    IReadOnlyList<InventoryMovementDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetInventoryMovementsQuery(
    Guid TenantId,
    int? ProductId = null,
    string? MovementType = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetInventoryMovementsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<InventoryMovementPageDto>> HandleAsync(GetInventoryMovementsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@ProductId", query.ProductId);
        parameters.Add("@MovementType", string.IsNullOrWhiteSpace(query.MovementType) ? null : query.MovementType.Trim());
        parameters.Add("@FromUtc", query.FromUtc);
        parameters.Add("@ToUtc", query.ToUtc);
        parameters.Add("@Search", string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim());
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<InventoryMovementDto>(
            connector,
            "[Inventory].[uspGetInventoryMovements]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<InventoryMovementPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<InventoryMovementPageDto>.Success(
            new InventoryMovementPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
