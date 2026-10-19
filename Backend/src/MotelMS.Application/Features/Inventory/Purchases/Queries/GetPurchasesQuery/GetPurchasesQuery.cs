using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Purchases.Queries.GetPurchasesQuery;

public sealed record PurchaseDto
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
    public int LineCount { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

/// <summary>Contadores del rango para las tarjetas de resumen de compras.</summary>
public sealed record PurchaseStatsDto(
    int Documents,
    decimal BoughtAmount,
    decimal ReturnedAmount);

/// <summary>Página del histórico de compras: solo la ventana pedida + el total para paginar.</summary>
public sealed record PurchasePageDto(
    IReadOnlyList<PurchaseDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    PurchaseStatsDto Stats);

public sealed record GetPurchasesQuery(
    Guid TenantId,
    string? Search = null,
    string? PurchaseType = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetPurchasesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<PurchasePageDto>> HandleAsync(GetPurchasesQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@PurchaseType", string.IsNullOrWhiteSpace(query.PurchaseType) ? null : query.PurchaseType.Trim());
        parameters.Add("@FromUtc", query.FromUtc);
        parameters.Add("@ToUtc", query.ToUtc);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@Documents", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@BoughtAmount", dbType: DbType.Decimal, direction: ParameterDirection.Output);
        parameters.Add("@ReturnedAmount", dbType: DbType.Decimal, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<PurchaseDto>(
            connector,
            "[Inventory].[uspGetPurchases]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<PurchasePageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new PurchaseStatsDto(
            parameters.Get<int?>("@Documents") ?? 0,
            parameters.Get<decimal?>("@BoughtAmount") ?? 0m,
            parameters.Get<decimal?>("@ReturnedAmount") ?? 0m);

        return Result<PurchasePageDto>.Success(
            new PurchasePageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
