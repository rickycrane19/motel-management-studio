using Dapper;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Features.Inventory.Suppliers.Queries.GetSuppliersQuery;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Suppliers.Queries.GetSupplierByIdQuery;

public sealed record SupplierPurchaseDto
{
    public int PurchaseId { get; init; }
    public string PurchaseType { get; init; } = string.Empty;
    public decimal TotalAmount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public DateTime? CreatedOnManagua { get; init; }
}

public sealed record SupplierDetailDto
{
    public SupplierDto? Supplier { get; set; }
    public List<SupplierPurchaseDto> RecentPurchases { get; set; } = [];
}

public sealed record GetSupplierByIdQuery(Guid TenantId, int SupplierId);

public sealed class GetSupplierByIdQueryHandler(ISqlConnector connector)
{
    public async Task<Result<SupplierDetailDto>> HandleAsync(GetSupplierByIdQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var multi = await connector.QueryMultipleAsync(
                "[Inventory].[uspGetSupplierById]",
                new { query.TenantId, query.SupplierId },
                cancellationToken);

            var supplier = await multi.ReadSingleOrDefaultAsync<SupplierDto>();
            if (supplier is null)
                return Result<SupplierDetailDto>.Failure(Error.NotFound("El proveedor no fue encontrado."));

            var recentPurchases = (await multi.ReadAsync<SupplierPurchaseDto>()).ToList();

            return Result<SupplierDetailDto>.Success(
                new SupplierDetailDto { Supplier = supplier, RecentPurchases = recentPurchases });
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            return Common.Data.SqlExceptionMapper.MapToResult<SupplierDetailDto>(ex);
        }
    }
}
