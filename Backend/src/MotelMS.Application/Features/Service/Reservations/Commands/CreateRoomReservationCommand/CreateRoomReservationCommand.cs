using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Reservations.Commands.CreateRoomReservationCommand;

public sealed record CreateRoomReservationCommand(
    Guid TenantId,
    Guid? LocationId,
    int RoomId,
    int? CustomerId,
    string CustomerName,
    string? Phone,
    int ServiceStayTypeId,
    DateTime ReservationStartUtc,
    DateTime ReservationEndUtc,
    decimal DepositAmount = 0,
    string? Notes = null,
    int? CreatedBy = null);

public sealed class CreateRoomReservationCommandValidator : AbstractValidator<CreateRoomReservationCommand>
{
    public CreateRoomReservationCommandValidator()
    {
        RuleFor(x => x.RoomId).GreaterThan(0);
        RuleFor(x => x.CustomerName).NotEmpty().WithMessage("El nombre del cliente es obligatorio para la reservación.");
        RuleFor(x => x.ReservationEndUtc).GreaterThan(x => x.ReservationStartUtc).WithMessage("La fecha de fin debe ser posterior al inicio.");
    }
}

public sealed class CreateRoomReservationCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(CreateRoomReservationCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@RoomId", command.RoomId);
        parameters.Add("@CustomerId", command.CustomerId);
        parameters.Add("@CustomerName", command.CustomerName);
        parameters.Add("@Phone", command.Phone);
        parameters.Add("@ServiceStayTypeId", command.ServiceStayTypeId);
        parameters.Add("@ReservationStartUtc", command.ReservationStartUtc);
        parameters.Add("@ReservationEndUtc", command.ReservationEndUtc);
        parameters.Add("@DepositAmount", command.DepositAmount);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspCreateRoomReservation]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
