using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.AddStayFineCommand;

/// <summary>Registra una multa / cargo por daño en una estancia activa.</summary>
public sealed record AddStayFineCommand(
    Guid TenantId,
    int RoomStayId,
    int? FineTypeId,
    string Description,
    decimal Amount,
    string CurrencyCode = "NIO",
    int? RecordedBy = null);

public sealed class AddStayFineCommandValidator : AbstractValidator<AddStayFineCommand>
{
    public AddStayFineCommandValidator()
    {
        RuleFor(x => x.RoomStayId).GreaterThan(0).WithMessage("La estancia debe ser válida.");
        RuleFor(x => x.Description).NotEmpty().WithMessage("Debes indicar el motivo de la multa.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("El monto de la multa debe ser mayor a cero.");
        RuleFor(x => x.CurrencyCode).NotEmpty().Length(3).WithMessage("La moneda es obligatoria (ISO de 3 letras).");
    }
}

public sealed class AddStayFineCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(AddStayFineCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new Dapper.DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@RoomStayId", command.RoomStayId);
        parameters.Add("@FineTypeId", command.FineTypeId);
        parameters.Add("@Description", command.Description);
        parameters.Add("@Amount", command.Amount);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@RecordedBy", command.RecordedBy);
        parameters.Add("@InsertedId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspAddRoomStayFine]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
