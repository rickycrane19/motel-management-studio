using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using FluentValidation;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Rooms.Commands.SetRoomActiveCommand;

public sealed record SetRoomActiveCommand(
    Guid TenantId,
    int RoomId,
    bool IsActive);

public sealed class SetRoomActiveCommandValidator : AbstractValidator<SetRoomActiveCommand>
{
    public SetRoomActiveCommandValidator()
    {
        RuleFor(x => x.RoomId).GreaterThan(0).WithMessage("El ID de la habitación no es válido.");
    }
}

public sealed class SetRoomActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetRoomActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetRoomActive]",
            new
            {
                command.TenantId,
                command.RoomId,
                command.IsActive
            },
            cancellationToken);
    }
}
