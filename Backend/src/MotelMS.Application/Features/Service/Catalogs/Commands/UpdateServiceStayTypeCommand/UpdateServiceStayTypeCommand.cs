using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Catalogs.Commands.UpdateServiceStayTypeCommand;

public sealed record UpdateServiceStayTypeCommand(
    Guid TenantId,
    int ServiceStayTypeId,
    int? RoomTypeId,
    string Name,
    decimal DurationHours,
    decimal Price,
    bool IsExtension = false,
    bool IsActive = true);

public sealed class UpdateServiceStayTypeCommandValidator : AbstractValidator<UpdateServiceStayTypeCommand>
{
    public UpdateServiceStayTypeCommandValidator()
    {
        RuleFor(x => x.ServiceStayTypeId).GreaterThan(0).WithMessage("El ID del tipo de servicio de estancia no es válido.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre del servicio de estancia es obligatorio.");
        RuleFor(x => x.DurationHours).GreaterThan(0).WithMessage("La duración en horas debe ser mayor a 0.");
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("El precio no puede ser negativo.");
    }
}

public sealed class UpdateServiceStayTypeCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateServiceStayTypeCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspUpdateServiceStayType]",
            new
            {
                command.TenantId,
                command.ServiceStayTypeId,
                command.RoomTypeId,
                command.Name,
                command.DurationHours,
                command.Price,
                command.IsExtension,
                command.IsActive
            },
            cancellationToken);
    }
}
