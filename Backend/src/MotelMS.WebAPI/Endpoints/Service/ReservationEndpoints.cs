using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Contracts.Time;
using MotelMS.Application.Features.Service.Reservations.Commands.CreateRoomReservationCommand;
using MotelMS.Application.Features.Service.Reservations.Commands.SetRoomReservationStatusCommand;
using MotelMS.Application.Features.Service.Reservations.Queries.GetRoomReservationsQuery;
using MotelMS.WebAPI.Extensions;
using MotelMS.WebAPI.Realtime;

namespace MotelMS.WebAPI.Endpoints.Service;

public sealed class ReservationEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/service/reservations").WithTags("Service.Reservations").RequireAuthorization();

        group.MapGet("/", async (
            string? search,
            byte? status,
            DateTimeOffset? from,
            DateTimeOffset? to,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetRoomReservationsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetRoomReservationsQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                status,
                from?.UtcDateTime,
                to?.UtcDateTime,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapPost("/", async (
            CreateRoomReservationCommand command,
            IValidator<CreateRoomReservationCommand> validator,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider,
            CreateRoomReservationCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            // Las fechas llegan en UTC o como hora local de Managua (sin offset); se normalizan SIEMPRE a UTC.
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId,
                ReservationStartUtc = ToUtc(command.ReservationStartUtc, dateTimeProvider),
                ReservationEndUtc = ToUtc(command.ReservationEndUtc, dateTimeProvider)
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "ReservationCreated", new { reservationId = result.Value });

            return result.ToCreated(id => $"api/service/reservations/{id}");
        });

        group.MapPut("/{reservationId:int}/status", async (
            int reservationId,
            SetRoomReservationStatusCommand command,
            IValidator<SetRoomReservationStatusCommand> validator,
            ICurrentUserService currentUser,
            SetRoomReservationStatusCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { ReservationId = reservationId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.RoomsChangedAsync(currentUser.TenantId, "ReservationStatusChanged", new { reservationId, status = request.Status });

            return result.ToNoContent();
        });
    }

    private static DateTime ToUtc(DateTime value, IDateTimeProvider provider) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => provider.ToUtc(value)
    };
}
