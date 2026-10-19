using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Suppliers.Queries.GetSuppliersQuery;

public sealed record SupplierDto
{
    public int SupplierId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? ContactName { get; init; }
    public string? Phone { get; init; }
    public string? Email { get; init; }
    public string? Address { get; init; }
    public string? TaxId { get; init; }
    public string? Notes { get; init; }
    public bool IsActive { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
    public int PurchasesCount { get; init; }
    public DateTime? LastPurchaseManagua { get; init; }
}

/// <summary>Contadores del maestro para las tarjetas de resumen (sin traer los registros).</summary>
public sealed record SupplierStatsDto(
    int Total,
    int Active,
    int WithPurchases);

/// <summary>Página del maestro de proveedores: solo la ventana pedida + el total para paginar.</summary>
public sealed record SupplierPageDto(
    IReadOnlyList<SupplierDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    SupplierStatsDto Stats);

public sealed record GetSuppliersQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    int Page = 1,
    int PageSize = 50);

public sealed class GetSuppliersQueryHandler(ISqlConnector connector)
{
    public async Task<Result<SupplierPageDto>> HandleAsync(GetSuppliersQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize switch
        {
            < 1 => 50,
            > 500 => 500,
            _ => query.PageSize
        };

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", query.TenantId);
        parameters.Add("@Search", string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim());
        parameters.Add("@OnlyActive", query.OnlyActive);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@TotalCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@WithPurchasesCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<SupplierDto>(
            connector,
            "[Inventory].[uspGetSuppliers]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<SupplierPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new SupplierStatsDto(
            parameters.Get<int?>("@TotalCount") ?? 0,
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@WithPurchasesCount") ?? 0);
        return Result<SupplierPageDto>.Success(
            new SupplierPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
