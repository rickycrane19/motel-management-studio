using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.CustomerReturns.Queries.GetCustomerReturnDetailQuery;

public sealed record CustomerReturnDetailDto
{
    public CustomerReturnHeaderDto? Header { get; set; }
    public List<CustomerReturnItemDto> Items { get; set; } = [];
}

public sealed record CustomerReturnHeaderDto
{
    public int CustomerReturnId { get; init; }
    public string? CustomerName { get; init; }
    public int? RoomStayId { get; init; }
    public decimal TotalRefund { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public int? CashBoxSessionId { get; init; }
    public string? Notes { get; init; }
    public DateTime CreatedOnUtc { get; init; }
    public DateTime? CreatedOnManagua { get; init; }
}

public sealed record CustomerReturnItemDto
{
    public int CustomerReturnItemId { get; init; }
    public int ProductId { get; init; }
    public string ProductName { get; init; } = string.Empty;
    public string ProductCode { get; init; } = string.Empty;
    public string UnitOfMeasure { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal UnitPrice { get; init; }
    public decimal LineTotal { get; init; }
    public string? Notes { get; init; }
}

public sealed record GetCustomerReturnDetailQuery(Guid TenantId, int CustomerReturnId);

public sealed class GetCustomerReturnDetailQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CustomerReturnDetailDto>> HandleAsync(GetCustomerReturnDetailQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var multi = await connector.QueryMultipleAsync(
                "[Inventory].[uspGetCustomerReturnDetail]",
                new { query.TenantId, query.CustomerReturnId },
                cancellationToken);

            var header = await multi.ReadSingleOrDefaultAsync<CustomerReturnHeaderDto>();
            if (header is null)
                return Result<CustomerReturnDetailDto>.Failure(Error.NotFound("La devolución no fue encontrada."));

            var items = (await multi.ReadAsync<CustomerReturnItemDto>()).ToList();

            return Result<CustomerReturnDetailDto>.Success(new CustomerReturnDetailDto { Header = header, Items = items });
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            return Common.Data.SqlExceptionMapper.MapToResult<CustomerReturnDetailDto>(ex);
        }
    }
}
