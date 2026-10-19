using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Rooms.Commands.InsertRoomCommand;

public sealed record InsertRoomCommand(
    Guid TenantId,
    Guid? LocationId,
    string RoomNumber,
    int RoomTypeId,
    int FloorNumber = 1,
    string? Notes = null);

public sealed class InsertRoomCommandValidator : AbstractValidator<InsertRoomCommand>
{
    public InsertRoomCommandValidator()
    {
        RuleFor(x => x.RoomNumber).NotEmpty().WithMessage("El número de habitación es obligatorio.");
        RuleFor(x => x.RoomTypeId).GreaterThan(0).WithMessage("El tipo de habitación debe ser válido.");
    }
}

public sealed class InsertRoomCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertRoomCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@RoomNumber", command.RoomNumber);
        parameters.Add("@RoomTypeId", command.RoomTypeId);
        parameters.Add("@FloorNumber", command.FloorNumber);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspInsertRoom]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
