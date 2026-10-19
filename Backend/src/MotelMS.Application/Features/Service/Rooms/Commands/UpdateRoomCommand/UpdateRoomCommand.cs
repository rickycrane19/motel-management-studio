using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Rooms.Commands.UpdateRoomCommand;

public sealed record UpdateRoomCommand(
    Guid TenantId,
    int RoomId,
    string RoomNumber,
    int RoomTypeId,
    int FloorNumber = 1,
    string? Notes = null);

public sealed class UpdateRoomCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateRoomCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspUpdateRoom]",
            new
            {
                command.TenantId,
                command.RoomId,
                command.RoomNumber,
                command.RoomTypeId,
                command.FloorNumber,
                command.Notes
            },
            cancellationToken);
    }
}
