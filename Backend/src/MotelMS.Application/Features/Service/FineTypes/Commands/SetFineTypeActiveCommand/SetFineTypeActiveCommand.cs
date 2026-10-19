using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.FineTypes.Commands.SetFineTypeActiveCommand;

public sealed record SetFineTypeActiveCommand(
    Guid TenantId,
    int FineTypeId,
    bool IsActive);

public sealed class SetFineTypeActiveCommandValidator : AbstractValidator<SetFineTypeActiveCommand>
{
    public SetFineTypeActiveCommandValidator()
    {
        RuleFor(x => x.FineTypeId).GreaterThan(0).WithMessage("El ID del tipo de multa no es válido.");
    }
}

public sealed class SetFineTypeActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetFineTypeActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetFineTypeActive]",
            new
            {
                command.TenantId,
                command.FineTypeId,
                command.IsActive
            },
            cancellationToken);
    }
}
