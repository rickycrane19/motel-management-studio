using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Rooms.Commands.SetRoomCleaningFinishedCommand;

public sealed record SetRoomCleaningFinishedCommand(Guid TenantId, int RoomId);

public sealed class SetRoomCleaningFinishedCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetRoomCleaningFinishedCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspSetRoomCleaningFinished]",
            new { command.TenantId, command.RoomId },
            cancellationToken);
    }
}
