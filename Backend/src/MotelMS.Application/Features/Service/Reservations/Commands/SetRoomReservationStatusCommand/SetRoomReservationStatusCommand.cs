using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Reservations.Commands.SetRoomReservationStatusCommand;

public sealed record SetRoomReservationStatusCommand(
    Guid TenantId,
    int ReservationId,
    byte Status);

public sealed class SetRoomReservationStatusCommandValidator : AbstractValidator<SetRoomReservationStatusCommand>
{
    public SetRoomReservationStatusCommandValidator()
    {
        RuleFor(x => x.ReservationId).GreaterThan(0).WithMessage("La reservación no es válida.");
        RuleFor(x => x.Status).Must(status => status is 3 or 4)
            .WithMessage("Solo se puede cancelar la reservación o marcarla como No Show.");
    }
}

public sealed class SetRoomReservationStatusCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetRoomReservationStatusCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetRoomReservationStatus]",
            new { command.TenantId, command.ReservationId, command.Status },
            cancellationToken);
    }
}
