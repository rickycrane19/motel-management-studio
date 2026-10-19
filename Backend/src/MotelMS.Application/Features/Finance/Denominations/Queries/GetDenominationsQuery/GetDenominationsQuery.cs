using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.Denominations.Queries.GetDenominationsQuery;

public sealed record DenominationDto
{
    public int DenominationId { get; init; }
    public string CurrencyCode { get; init; } = string.Empty;
    public string CurrencyName { get; init; } = string.Empty;
    public string? CurrencySymbol { get; init; }
    public decimal Value { get; init; }
    public string Label { get; init; } = string.Empty;
    public decimal ExchangeRateToNIO { get; init; }
}

public sealed record GetDenominationsQuery(Guid TenantId);

public sealed class GetDenominationsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<IEnumerable<DenominationDto>>> HandleAsync(GetDenominationsQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QueryAsync<DenominationDto>(
            connector,
            "[Finance].[uspGetDenominations]",
            new { query.TenantId },
            cancellationToken);
    }
}
