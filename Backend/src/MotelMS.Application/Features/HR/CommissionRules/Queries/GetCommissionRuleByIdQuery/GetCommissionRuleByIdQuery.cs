using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Features.HR.CommissionRules.Queries.GetCommissionRulesQuery;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.CommissionRules.Queries.GetCommissionRuleByIdQuery;

public sealed record GetCommissionRuleByIdQuery(Guid TenantId, int RuleId);

public sealed class GetCommissionRuleByIdQueryHandler(ISqlConnector connector)
{
    public async Task<Result<CommissionRuleDto?>> HandleAsync(GetCommissionRuleByIdQuery query, CancellationToken cancellationToken = default)
    {
        var parameters = new
        {
            query.TenantId,
            query.RuleId,
            Page = 1,
            PageSize = 1
        };

        return await QueryRunner.QuerySingleOrDefaultAsync<CommissionRuleDto>(
            connector,
            "[HR].[uspGetCommissionRules]",
            parameters,
            cancellationToken);
    }
}
