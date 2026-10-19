using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.CommissionRules.Commands.SetCommissionRuleActiveCommand;

public sealed record SetCommissionRuleActiveCommand(
    Guid TenantId,
    int RuleId,
    bool IsActive);

public sealed record SetCommissionRuleActiveRequest(bool IsActive);

public sealed class SetCommissionRuleActiveCommandValidator : AbstractValidator<SetCommissionRuleActiveCommand>
{
    public SetCommissionRuleActiveCommandValidator()
    {
        RuleFor(x => x.RuleId).GreaterThan(0).WithMessage("La regla de comisión indicada no es válida.");
    }
}

public sealed class SetCommissionRuleActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetCommissionRuleActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[HR].[uspSetCommissionRuleActive]",
            new
            {
                command.TenantId,
                command.RuleId,
                command.IsActive
            },
            cancellationToken);
    }
}
