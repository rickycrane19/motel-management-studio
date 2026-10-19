using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetProductSalesReportQuery;

public sealed record ProductSalesRowDto
{
    public int ProductId { get; init; }
    public string ProductCode { get; init; } = string.Empty;
    public string ProductName { get; init; } = string.Empty;
    public string? CategoryName { get; init; }
    public string UnitOfMeasure { get; init; } = "UND";
    public decimal SoldQuantity { get; init; }
    public decimal Revenue { get; init; }
    public decimal Cost { get; init; }
    public decimal Margin { get; init; }
    public int StaysWithSale { get; init; }
}

public sealed record ProductSalesReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<ProductSalesRowDto> Rows);

public sealed record GetProductSalesReportQuery(Guid TenantId, DateTime FromUtc, DateTime ToUtc);

public sealed class GetProductSalesReportQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ProductSalesReport>> HandleAsync(
        GetProductSalesReportQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QueryAsync<ProductSalesRowDto>(
            connector,
            "[Finance].[uspGetProductSalesReport]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);

        if (result.IsFailure)
            return Result<ProductSalesReport>.Failure(result.Error!);

        return Result<ProductSalesReport>.Success(
            new ProductSalesReport(query.FromUtc, query.ToUtc, result.Value.ToList()));
    }
}
