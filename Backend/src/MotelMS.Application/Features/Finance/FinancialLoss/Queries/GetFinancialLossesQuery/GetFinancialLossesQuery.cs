using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.FinancialLoss.Queries.GetFinancialLossesQuery;

public sealed record FinancialLossDto
{
    public int LossId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string CategoryCode { get; init; } = "Otro";
    public string CategoryName { get; init; } = "Otro";
    public int? RoomId { get; init; }
    public string? RoomNumber { get; init; }
    public int? RoomStayId { get; init; }
    public string Description { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public string CurrencyCode { get; init; } = "NIO";
    public decimal ExchangeRate { get; init; }
    public decimal AmountInBase { get; init; }
    public int? CashBoxSessionId { get; init; }
    public DateTime? RecordedAtManagua { get; init; }
    public string? CreatedByName { get; init; }
}

/// <summary>Página del listado de pérdidas: solo la ventana pedida + el total para paginar.</summary>
public sealed record FinancialLossPageDto(
    IReadOnlyList<FinancialLossDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetFinancialLossesQuery(
    Guid TenantId,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    string? CategoryCode = null,
    int Page = 1,
    int PageSize = 50);

public sealed class GetFinancialLossesQueryHandler(ISqlConnector connector)
{
    public async Task<Result<FinancialLossPageDto>> HandleAsync(GetFinancialLossesQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize switch
        {
            < 1 => 50,
            > 200 => 200,
            _ => query.PageSize
        };

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", query.TenantId);
        parameters.Add("@FromUtc", query.FromUtc);
        parameters.Add("@ToUtc", query.ToUtc);
        parameters.Add("@CategoryCode", string.IsNullOrWhiteSpace(query.CategoryCode) ? null : query.CategoryCode.Trim());
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<FinancialLossDto>(
            connector,
            "[Finance].[uspGetFinancialLosses]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<FinancialLossPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<FinancialLossPageDto>.Success(
            new FinancialLossPageDto(result.Value.ToList(), total, page, pageSize));
    }
}
