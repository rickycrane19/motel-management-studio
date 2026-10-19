using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.StartRoomStayCommand;

public sealed record StartRoomStayCommand(
    Guid TenantId,
    Guid? LocationId,
    int RoomId,
    string? CustomerName,
    byte ArrivalType, // 1 = A pie, 2 = En vehículo
    string? VehiclePlate,
    int ServiceStayTypeId,
    int? CashBoxSessionId = null,
    int? CreatedBy = null,
    string? Notes = null);

public sealed class StartRoomStayCommandValidator : AbstractValidator<StartRoomStayCommand>
{
    public StartRoomStayCommandValidator()
    {
        RuleFor(x => x.RoomId).GreaterThan(0).WithMessage("La habitación debe ser válida.");
        RuleFor(x => x.ServiceStayTypeId).GreaterThan(0).WithMessage("Debes seleccionar un servicio de estancia.");
        RuleFor(x => x.ArrivalType).Must(x => x is 1 or 2).WithMessage("El tipo de llegada debe ser 1 (A pie) o 2 (En vehículo).");
        When(x => x.ArrivalType == 2, () =>
        {
            RuleFor(x => x.VehiclePlate).NotEmpty().WithMessage("Para clientes en vehículo, la placa es obligatoria.");
        });
    }
}

public sealed class StartRoomStayCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(StartRoomStayCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@RoomId", command.RoomId);
        parameters.Add("@CustomerName", command.CustomerName);
        parameters.Add("@ArrivalType", command.ArrivalType);
        parameters.Add("@VehiclePlate", command.VehiclePlate);
        parameters.Add("@ServiceStayTypeId", command.ServiceStayTypeId);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspStartRoomStay]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
