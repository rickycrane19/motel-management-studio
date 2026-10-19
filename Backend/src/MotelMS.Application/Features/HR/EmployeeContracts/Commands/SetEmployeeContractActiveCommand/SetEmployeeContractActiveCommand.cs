using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeeContracts.Commands.SetEmployeeContractActiveCommand;

public sealed record SetEmployeeContractActiveCommand(
    Guid TenantId,
    int ContractId,
    bool IsActive);

public sealed record SetEmployeeContractActiveRequest(bool IsActive);

public sealed class SetEmployeeContractActiveCommandValidator : AbstractValidator<SetEmployeeContractActiveCommand>
{
    public SetEmployeeContractActiveCommandValidator()
    {
        RuleFor(x => x.ContractId).GreaterThan(0).WithMessage("El contrato indicado no es válido.");
    }
}

public sealed class SetEmployeeContractActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetEmployeeContractActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[HR].[uspSetEmployeeContractActive]",
            new
            {
                command.TenantId,
                command.ContractId,
                command.IsActive
            },
            cancellationToken);
    }
}
