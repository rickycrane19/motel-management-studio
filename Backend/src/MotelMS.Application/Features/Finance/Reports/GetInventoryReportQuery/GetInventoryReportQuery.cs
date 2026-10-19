using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetInventoryReportQuery;

public sealed record InventoryReportRowDto
{
    public int ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string CategoryName { get; init; } = string.Empty;
    public string UnitOfMeasure { get; init; } = "UND";
    public decimal CurrentStock { get; init; }
    public decimal MinStock { get; init; }
    public bool IsUnderMinStock { get; init; }
    public decimal CostPrice { get; init; }
    public decimal SalePrice { get; init; }
    public decimal StockValue { get; init; }

    public decimal PurchaseQuantity { get; init; }
    public decimal PurchaseCost { get; init; }
    public decimal SupplierReturnQuantity { get; init; }
    public decimal SupplierReturnCost { get; init; }
    public decimal CustomerReturnCost { get; init; }
    public decimal SoldQuantity { get; init; }
    public decimal SoldCost { get; init; }
    public decimal AdjustmentCost { get; init; }
}

public sealed record InventoryReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<InventoryReportRowDto> Rows);

public sealed record GetInventoryReportQuery(
    Guid TenantId,
    DateTime FromUtc,
    DateTime ToUtc);

public sealed class GetInventoryReportQueryHandler(ISqlConnector connector)
{
    public async Task<Result<InventoryReport>> HandleAsync(
        GetInventoryReportQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QueryAsync<InventoryReportRowDto>(
            connector,
            "[Finance].[uspGetInventoryReport]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);

        if (result.IsFailure)
            return Result<InventoryReport>.Failure(result.Error!);

        return Result<InventoryReport>.Success(
            new InventoryReport(query.FromUtc, query.ToUtc, result.Value.ToList()));
    }
}
