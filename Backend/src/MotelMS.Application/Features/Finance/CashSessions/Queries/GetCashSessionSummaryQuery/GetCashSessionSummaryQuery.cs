using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashSessions.Queries.GetCashSessionSummaryQuery;

public sealed record CashSessionSummaryDto
{
    public CashSessionSummaryHeaderDto? Header { get; set; }
    public List<CashSessionCountDto> Counts { get; set; } = [];
    public List<CashSessionAdjustmentDto> Adjustments { get; set; } = [];
}

public sealed record CashSessionSummaryHeaderDto
{
    public int CashBoxSessionId { get; init; }
    public int CashBoxId { get; init; }
    public string CashBoxName { get; init; } = string.Empty;
    public int UserId { get; init; }
    public string UserName { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public DateTime OpenedAtUtc { get; init; }
    public DateTime? ClosedAtUtc { get; init; }
    public DateTime? OpenedAtManagua { get; init; }
    public DateTime? ClosedAtManagua { get; init; }
    public byte StatusCode { get; init; }
    public string StatusName { get; init; } = string.Empty;
    public decimal OpeningBalanceBase { get; init; }
    public decimal TotalSalesBase { get; init; }
    public decimal TotalInAdjustmentsBase { get; init; }
    public decimal TotalOutAdjustmentsBase { get; init; }
    public decimal ClosingCalculatedBase { get; init; }
    public decimal ClosingActualBase { get; init; }
    public decimal DifferenceBase { get; init; }
    public string ArqueoResult { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

public sealed record CashSessionCountDto
{
    public int CashBoxCountId { get; init; }
    public int CountTypeId { get; init; }
    public string CountTypeName { get; init; } = string.Empty;
    public string CurrencyCode { get; init; } = string.Empty;
    public decimal DenominationValue { get; init; }
    public string Label { get; init; } = string.Empty;
    public int Count { get; init; }
    public decimal SubTotal { get; init; }
    public decimal SubTotalInBase { get; init; }
    public DateTime RecordedAt { get; init; }
    public DateTime? RecordedAtManagua { get; init; }
}

public sealed record CashSessionAdjustmentDto
{
    public int AdjustmentId { get; init; }
    public string AdjustmentType { get; init; } = string.Empty;
    public string AdjustmentTypeName { get; init; } = string.Empty;
    public string CurrencyCode { get; init; } = string.Empty;
    public decimal Amount { get; init; }
    public decimal ExchangeRate { get; init; }
    public decimal AmountInBase { get; init; }
    public string Reason { get; init; } = string.Empty;
    public DateTime RecordedAt { get; init; }
    public DateTime? RecordedAtManagua { get; init; }
}

public sealed record GetCashSessionSummaryQuery(Guid TenantId, int CashBoxSessionId);

public sealed class GetCashSessionSummaryQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CashSessionSummaryDto>> HandleAsync(GetCashSessionSummaryQuery query, CancellationToken cancellationToken = default)
    {
        try
        {
            await using var multi = await connector.QueryMultipleAsync(
                "[Finance].[uspGetCashSessionSummary]",
                new { query.TenantId, query.CashBoxSessionId },
                cancellationToken);

            var header = await multi.ReadSingleOrDefaultAsync<CashSessionSummaryHeaderDto>();
            if (header is null)
                return Result<CashSessionSummaryDto>.Failure(Error.NotFound("La sesión de caja no fue encontrada."));

            var counts = (await multi.ReadAsync<CashSessionCountDto>()).ToList();
            var adjustments = (await multi.ReadAsync<CashSessionAdjustmentDto>()).ToList();

            var dto = new CashSessionSummaryDto
            {
                Header = header,
                Counts = counts,
                Adjustments = adjustments
            };

            return Result<CashSessionSummaryDto>.Success(dto);
        }
        catch (Microsoft.Data.SqlClient.SqlException ex)
        {
            return SqlExceptionMapper.MapToResult<CashSessionSummaryDto>(ex);
        }
    }
}
