using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Catalogs.Commands.InsertServiceStayTypeCommand;

public sealed record InsertServiceStayTypeCommand(
    Guid TenantId,
    int? RoomTypeId,
    string Name,
    decimal DurationHours,
    decimal Price,
    bool IsExtension = false);

public sealed class InsertServiceStayTypeCommandValidator : AbstractValidator<InsertServiceStayTypeCommand>
{
    public InsertServiceStayTypeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre del servicio de estancia es obligatorio.");
        RuleFor(x => x.DurationHours).GreaterThan(0).WithMessage("La duración en horas debe ser mayor a 0.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("El precio no puede ser negativo.");
    }
}

public sealed class InsertServiceStayTypeCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertServiceStayTypeCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@RoomTypeId", command.RoomTypeId);
        parameters.Add("@Name", command.Name);
        parameters.Add("@DurationHours", command.DurationHours);
        parameters.Add("@Price", command.Price);
        parameters.Add("@IsExtension", command.IsExtension);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspInsertServiceStayType]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
