using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Service.Rooms.Commands.InsertRoomCommand;
using MotelMS.Application.Features.Service.Rooms.Commands.SetRoomActiveCommand;
using MotelMS.Application.Features.Service.Rooms.Commands.SetRoomCleaningFinishedCommand;
using MotelMS.Application.Features.Service.Rooms.Commands.UpdateRoomCommand;
using MotelMS.Application.Features.Service.Rooms.Queries.GetRoomsQuery;
using MotelMS.WebAPI.Extensions;
using MotelMS.WebAPI.Realtime;

namespace MotelMS.WebAPI.Endpoints.Service;

public sealed class RoomEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/service/rooms").WithTags("Service.Rooms").RequireAuthorization();

        group.MapGet("/", async (
            string? search,
            bool? onlyActive,
            int? roomTypeId,
            int? floor,
            byte? status,
            bool? includeInactive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetRoomsQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetRoomsQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                includeInactive ?? false,
                roomTypeId,
                floor,
                status,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        })
        .WithName("GetRooms");

        group.MapPost("/", async (
            InsertRoomCommand command,
            IValidator<InsertRoomCommand> validator,
            ICurrentUserService currentUser,
            InsertRoomCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId, LocationId = currentUser.LocationId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "RoomCreated", new { roomId = result.Value });

            return result.ToCreated(id => $"api/service/rooms/{id}");
        });

        group.MapPut("/{roomId:int}", async (
            int roomId,
            UpdateRoomCommand command,
            ICurrentUserService currentUser,
            UpdateRoomCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomId = roomId, TenantId = currentUser.TenantId };
            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "RoomUpdated", new { roomId });

            return result.ToNoContent();
        });

        group.MapPut("/{roomId:int}/set-active", async (
            int roomId,
            SetRoomActiveCommand command,
            IValidator<SetRoomActiveCommand> validator,
            ICurrentUserService currentUser,
            SetRoomActiveCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomId = roomId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "RoomUpdated", new { roomId });

            return result.ToNoContent();
        });

        group.MapPost("/{roomId:int}/cleaning-finished", async (
            int roomId,
            ICurrentUserService currentUser,
            SetRoomCleaningFinishedCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new SetRoomCleaningFinishedCommand(currentUser.TenantId, roomId), ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "RoomCleaned", new { roomId });

            return result.ToNoContent();
        });
    }
}
