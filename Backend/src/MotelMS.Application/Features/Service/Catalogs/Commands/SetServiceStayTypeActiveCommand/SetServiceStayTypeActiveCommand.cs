using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Catalogs.Commands.SetServiceStayTypeActiveCommand;

public sealed record SetServiceStayTypeActiveCommand(
    Guid TenantId,
    int ServiceStayTypeId,
    bool IsActive);

public sealed class SetServiceStayTypeActiveCommandValidator : AbstractValidator<SetServiceStayTypeActiveCommand>
{
    public SetServiceStayTypeActiveCommandValidator()
    {
        RuleFor(x => x.ServiceStayTypeId).GreaterThan(0).WithMessage("El ID del tipo de servicio de estancia no es válido.");
    }
}

public sealed class SetServiceStayTypeActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetServiceStayTypeActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetServiceStayTypeActive]",
            new
            {
                command.TenantId,
                command.ServiceStayTypeId,
                command.IsActive
            },
            cancellationToken);
    }
}
