using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Products.Queries.GetProductsQuery;

public sealed record ProductDto
{
    public int ProductId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public int CategoryId { get; init; }
    public string CategoryName { get; init; } = string.Empty;
    public string Code { get; init; } = string.Empty;
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public decimal CostPrice { get; init; }
    public decimal SalePrice { get; init; }
    public decimal CurrentStock { get; init; }
    public decimal MinStock { get; init; }
    public string UnitOfMeasure { get; init; } = "UND";
    public string? ImageUrl { get; init; }
    public bool IsActive { get; init; }
    public bool IsLowStock { get; init; }
}

/// <summary>Página del catálogo: solo la ventana pedida + el total para paginar en la UI.</summary>
public sealed record ProductPageDto(
    IReadOnlyList<ProductDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetProductsQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int? CategoryId = null,
    int? ProductId = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetProductsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ProductPageDto>> HandleAsync(GetProductsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@CategoryId", query.CategoryId);
        parameters.Add("@ProductId", query.ProductId);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<ProductDto>(
            connector,
            "[Inventory].[uspGetProducts]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<ProductPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<ProductPageDto>.Success(
            new ProductPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
