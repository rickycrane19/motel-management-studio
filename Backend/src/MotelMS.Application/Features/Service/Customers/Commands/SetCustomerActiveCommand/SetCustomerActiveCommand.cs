using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Customers.Commands.SetCustomerActiveCommand;

public sealed record SetCustomerActiveCommand(
    Guid TenantId,
    int CustomerId,
    bool IsActive);

public sealed class SetCustomerActiveCommandValidator : AbstractValidator<SetCustomerActiveCommand>
{
    public SetCustomerActiveCommandValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0).WithMessage("El cliente no es válido.");
    }
}

public sealed class SetCustomerActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetCustomerActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetCustomerActive]",
            new { command.TenantId, command.CustomerId, command.IsActive },
            cancellationToken);
    }
}
