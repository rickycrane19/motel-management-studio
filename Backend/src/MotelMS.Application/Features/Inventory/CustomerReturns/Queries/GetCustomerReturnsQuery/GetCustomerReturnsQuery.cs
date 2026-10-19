using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.CustomerReturns.Queries.GetCustomerReturnsQuery;

public sealed record CustomerReturnDto
{
    public int CustomerReturnId { get; init; }
    public string? CustomerName { get; init; }
    public int? RoomStayId { get; init; }
    public decimal TotalRefund { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public int? CashBoxSessionId { get; init; }
    public string? Notes { get; init; }
    public int LineCount { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

/// <summary>Contadores del rango para las tarjetas de resumen de devoluciones.</summary>
public sealed record CustomerReturnStatsDto(
    int Documents,
    decimal RefundedAmount);

/// <summary>Página del histórico de devoluciones: solo la ventana pedida + el total para paginar.</summary>
public sealed record CustomerReturnPageDto(
    IReadOnlyList<CustomerReturnDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    CustomerReturnStatsDto Stats);

public sealed record GetCustomerReturnsQuery(
    Guid TenantId,
    string? Search = null,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetCustomerReturnsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CustomerReturnPageDto>> HandleAsync(GetCustomerReturnsQuery query, CancellationToken cancellationToken = default)
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
        parameters.Add("@FromUtc", query.FromUtc);
        parameters.Add("@ToUtc", query.ToUtc);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@Documents", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@RefundedAmount", dbType: DbType.Decimal, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<CustomerReturnDto>(
            connector,
            "[Inventory].[uspGetCustomerReturns]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<CustomerReturnPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new CustomerReturnStatsDto(
            parameters.Get<int?>("@Documents") ?? 0,
            parameters.Get<decimal?>("@RefundedAmount") ?? 0m);

        return Result<CustomerReturnPageDto>.Success(
            new CustomerReturnPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
