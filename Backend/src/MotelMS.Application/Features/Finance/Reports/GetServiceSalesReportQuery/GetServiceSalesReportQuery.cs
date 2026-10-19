using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Reports.GetServiceSalesReportQuery;

public sealed record ServiceSalesRowDto
{
    public int ServiceStayTypeId { get; init; }
    public string StayTypeName { get; init; } = string.Empty;
    public int ArrivalType { get; init; }
    public string ArrivalName { get; init; } = string.Empty;
    public int Stays { get; init; }
    public decimal BaseRevenue { get; init; }
    public decimal ExtensionRevenue { get; init; }
    public decimal ProductsRevenue { get; init; }
    public decimal FinesRevenue { get; init; }
    public decimal TotalRevenue { get; init; }
    public decimal AvgStayTotal { get; init; }
    public decimal AvgHours { get; init; }
}

public sealed record ServiceSalesReport(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<ServiceSalesRowDto> Rows);

public sealed record GetServiceSalesReportQuery(Guid TenantId, DateTime FromUtc, DateTime ToUtc);

public sealed class GetServiceSalesReportQueryHandler(ISqlConnector connector)
{
    public async Task<Result<ServiceSalesReport>> HandleAsync(
        GetServiceSalesReportQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QueryAsync<ServiceSalesRowDto>(
            connector,
            "[Finance].[uspGetServiceSalesReport]",
            new { query.TenantId, query.FromUtc, query.ToUtc },
            cancellationToken);

        if (result.IsFailure)
            return Result<ServiceSalesReport>.Failure(result.Error!);

        return Result<ServiceSalesReport>.Success(
            new ServiceSalesReport(query.FromUtc, query.ToUtc, result.Value.ToList()));
    }
}
