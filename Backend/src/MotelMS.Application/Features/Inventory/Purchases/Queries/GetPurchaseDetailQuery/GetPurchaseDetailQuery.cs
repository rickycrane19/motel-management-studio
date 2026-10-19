using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Purchases.Queries.GetPurchaseDetailQuery;

public sealed record PurchaseDetailDto
{
    public PurchaseHeaderDto? Header { get; set; }
    public List<PurchaseItemDto> Items { get; set; } = [];
}

public sealed record PurchaseHeaderDto
{
    public int PurchaseId { get; init; }
    public string PurchaseType { get; init; } = string.Empty;
    public int? SupplierId { get; init; }
    public string? SupplierName { get; init; }
    public string? ReferenceDoc { get; init; }
    public decimal TotalAmount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public int? CashBoxSessionId { get; init; }
    public string? Notes { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

public sealed record PurchaseItemDto
{
    public int PurchaseItemId { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductCode { get; init; } = string.Empty;
    public string UnitOfMeasure { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitCost { get; init; }
    public decimal LineTotal { get; init; }
    public string? Notes { get; init; }
}

public sealed record GetPurchaseDetailQuery(Guid TenantId, int PurchaseId);

public sealed class GetPurchaseDetailQueryHandler(ISqlConnector connector)
{
    public async Task<Result<PurchaseDetailDto>> HandleAsync(GetPurchaseDetailQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var multi = await connector.QueryMultipleAsync(
                "[Inventory].[uspGetPurchaseDetail]",
                new { query.TenantId, query.PurchaseId },
                cancellationToken);

            var header = await multi.ReadSingleOrDefaultAsync<PurchaseHeaderDto>();
            if (header is null)
                return Result<PurchaseDetailDto>.Failure(Error.NotFound("El documento no fue encontrado."));

            var items = (await multi.ReadAsync<PurchaseItemDto>()).ToList();

            return Result<PurchaseDetailDto>.Success(new PurchaseDetailDto { Header = header, Items = items });
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            return Common.Data.SqlExceptionMapper.MapToResult<PurchaseDetailDto>(ex);
        }
    }
}
