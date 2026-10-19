using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Service.RoomStays.Commands.AddStayConsumptionCommand;
using MotelMS.Application.Features.Service.RoomStays.Commands.AddStayFineCommand;
using MotelMS.Application.Features.Service.RoomStays.Commands.CheckoutRoomStayCommand;
using MotelMS.Application.Features.Service.RoomStays.Commands.ExtendRoomStayCommand;
using MotelMS.Application.Features.Service.RoomStays.Commands.StartRoomStayCommand;
using MotelMS.Application.Features.Service.RoomStays.Commands.WaiveStayFineCommand;
using MotelMS.Application.Features.Service.RoomStays.Queries.GetRoomStayDetailQuery;
using MotelMS.Application.Features.Service.RoomStays.Queries.GetRoomStayFinesQuery;
using MotelMS.WebAPI.Extensions;
using MotelMS.WebAPI.Realtime;

namespace MotelMS.WebAPI.Endpoints.Service;

public sealed class RoomStayEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/service/stays").WithTags("Service.RoomStays").RequireAuthorization();

        // Check-in / inicio de servicio
        group.MapPost("/", async (
            StartRoomStayCommand command,
            IValidator<StartRoomStayCommand> validator,
            ICurrentUserService currentUser,
            StartRoomStayCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "StayStarted", new { roomStayId = result.Value, roomId = request.RoomId });

            return result.ToCreated(id => $"api/service/stays/{id}");
        })
        .WithName("StartRoomStay");

        // Estado de cuenta
        group.MapGet("/{roomStayId:int}", async (
            int roomStayId,
            ICurrentUserService currentUser,
            GetRoomStayDetailQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetRoomStayDetailQuery(currentUser.TenantId, roomStayId), ct);
            return result.ToOk();
        });

        // Extender tiempo
        group.MapPost("/{roomStayId:int}/extend", async (
            int roomStayId,
            ExtendRoomStayCommand command,
            ICurrentUserService currentUser,
            ExtendRoomStayCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomStayId = roomStayId, TenantId = currentUser.TenantId, CreatedBy = currentUser.UserId };
            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "StayExtended", new { roomStayId });

            return result.ToCreated(id => $"api/service/stays/{roomStayId}");
        });

        // Agregar consumo de minibar
        group.MapPost("/{roomStayId:int}/consumptions", async (
            int roomStayId,
            AddStayConsumptionCommand command,
            IValidator<AddStayConsumptionCommand> validator,
            ICurrentUserService currentUser,
            AddStayConsumptionCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomStayId = roomStayId, TenantId = currentUser.TenantId, CreatedBy = currentUser.UserId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "ConsumptionAdded", new { roomStayId });

            return result.ToCreated(id => $"api/service/stays/{roomStayId}");
        });

        // Registrar multa / daño
        group.MapPost("/{roomStayId:int}/fines", async (
            int roomStayId,
            AddStayFineCommand command,
            IValidator<AddStayFineCommand> validator,
            ICurrentUserService currentUser,
            AddStayFineCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomStayId = roomStayId, TenantId = currentUser.TenantId, RecordedBy = currentUser.UserId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "FineAdded", new { roomStayId });

            return result.ToCreated(id => $"api/service/fines/{id}");
        });

        // Listar multas de la estancia
        group.MapGet("/{roomStayId:int}/fines", async (
            int roomStayId,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetRoomStayFinesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetRoomStayFinesQuery(
                currentUser.TenantId,
                roomStayId,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        // Check-out / cobro
        group.MapPost("/{roomStayId:int}/checkout", async (
            int roomStayId,
            CheckoutRoomStayCommand command,
            IValidator<CheckoutRoomStayCommand> validator,
            ICurrentUserService currentUser,
            CheckoutRoomStayCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { RoomStayId = roomStayId, TenantId = currentUser.TenantId, UserId = currentUser.UserId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
            {
                await publisher.RoomsChangedAsync(currentUser.TenantId, "StayCheckedOut", new { roomStayId });
                await publisher.CashChangedAsync(currentUser.TenantId, "CheckoutPaid", new { roomStayId, request.PaidAmount });
            }

            return result.ToNoContent();
        })
        .WithName("CheckoutRoomStay");

        // Anular multa
        group.MapPost("/fines/{fineId:int}/waive", async (
            int fineId,
            WaiveStayFineCommand command,
            IValidator<WaiveStayFineCommand> validator,
            ICurrentUserService currentUser,
            WaiveStayFineCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { FineId = fineId, TenantId = currentUser.TenantId, WaivedBy = currentUser.UserId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "FineWaived", new { fineId });

            return result.ToNoContent();
        });
    }
}
