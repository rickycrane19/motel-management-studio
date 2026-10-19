using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Categories.Queries.GetCategoriesQuery;

public sealed record CategoryDto
{
    public int CategoryId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public bool IsActive { get; init; }
}

/// <summary>Página del maestro de categorías: solo la ventana pedida + el total para paginar.</summary>
public sealed record CategoryPageDto(
    IReadOnlyList<CategoryDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetCategoriesQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetCategoriesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CategoryPageDto>> HandleAsync(GetCategoriesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<CategoryDto>(
            connector,
            "[Inventory].[uspGetCategories]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<CategoryPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<CategoryPageDto>.Success(
            new CategoryPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
