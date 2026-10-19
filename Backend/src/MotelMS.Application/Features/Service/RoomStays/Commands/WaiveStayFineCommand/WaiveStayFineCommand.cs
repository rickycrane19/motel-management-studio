using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.WaiveStayFineCommand;

/// <summary>Anula (condona) una multa registrada en una estancia.</summary>
public sealed record WaiveStayFineCommand(
    Guid TenantId,
    int FineId,
    string? WaivedReason = null,
    int? WaivedBy = null);

public sealed class WaiveStayFineCommandValidator : AbstractValidator<WaiveStayFineCommand>
{
    public WaiveStayFineCommandValidator()
    {
        RuleFor(x => x.FineId).GreaterThan(0).WithMessage("La multa debe ser válida.");
    }
}

public sealed class WaiveStayFineCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(WaiveStayFineCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspWaiveRoomStayFine]",
            new
            {
                command.TenantId,
                command.FineId,
                command.WaivedReason,
                command.WaivedBy
            },
            cancellationToken);
    }
}
