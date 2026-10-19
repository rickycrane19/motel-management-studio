using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.FineTypes.Commands.UpdateFineTypeCommand;

public sealed record UpdateFineTypeCommand(
    Guid TenantId,
    int FineTypeId,
    string Name,
    string? Description = null,
    decimal DefaultAmount = 0,
    bool IsActive = true);

public sealed class UpdateFineTypeCommandValidator : AbstractValidator<UpdateFineTypeCommand>
{
    public UpdateFineTypeCommandValidator()
    {
        RuleFor(x => x.FineTypeId).GreaterThan(0).WithMessage("El tipo de multa debe ser válido.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120).WithMessage("El nombre del tipo de multa es obligatorio.");
    }
}

public sealed class UpdateFineTypeCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateFineTypeCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspUpdateFineType]",
            new
            {
                command.TenantId,
                command.FineTypeId,
                command.Name,
                command.Description,
                command.DefaultAmount,
                command.IsActive
            },
            cancellationToken);
    }
}
