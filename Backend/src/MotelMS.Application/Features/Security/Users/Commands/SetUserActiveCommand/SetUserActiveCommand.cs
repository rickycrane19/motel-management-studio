using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Users.Commands.SetUserActiveCommand;

public sealed record SetUserActiveCommand(
    Guid TenantId,
    int UserId,
    bool IsActive,
    int CurrentUserId = 0);

public sealed class SetUserActiveCommandValidator : AbstractValidator<SetUserActiveCommand>
{
    public SetUserActiveCommandValidator()
    {
        RuleFor(x => x.UserId).GreaterThan(0).WithMessage("El usuario no es válido.");
    }
}

public sealed class SetUserActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetUserActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Security].[uspSetUserActive]",
            new
            {
                command.TenantId,
                command.UserId,
                command.IsActive,
                CurrentUserId = command.CurrentUserId > 0 ? command.CurrentUserId : (int?)null
            },
            cancellationToken);
    }
}
