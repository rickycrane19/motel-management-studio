using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.Customers.Commands.UpdateCustomerCommand;

public sealed record UpdateCustomerCommand(
    Guid TenantId,
    int CustomerId,
    string FullName,
    string? DocumentNumber = null,
    string? Phone = null,
    string? Email = null,
    string? Notes = null);

public sealed class UpdateCustomerCommandValidator : AbstractValidator<UpdateCustomerCommand>
{
    public UpdateCustomerCommandValidator()
    {
        RuleFor(x => x.CustomerId).GreaterThan(0).WithMessage("El cliente no es válido.");
        RuleFor(x => x.FullName).NotEmpty().WithMessage("El nombre del cliente es obligatorio.")
            .MaximumLength(150).WithMessage("El nombre del cliente admite máximo 150 caracteres.");
        RuleFor(x => x.DocumentNumber).MaximumLength(50).WithMessage("El documento admite máximo 50 caracteres.");
        RuleFor(x => x.Phone).MaximumLength(50).WithMessage("El teléfono admite máximo 50 caracteres.");
        RuleFor(x => x.Email).MaximumLength(150).WithMessage("El correo admite máximo 150 caracteres.")
            .EmailAddress().WithMessage("El correo del cliente no tiene un formato válido.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Notes).MaximumLength(300).WithMessage("Las notas admiten máximo 300 caracteres.");
    }
}

public sealed class UpdateCustomerCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateCustomerCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Service].[uspUpdateCustomer]",
            new
            {
                command.TenantId,
                command.CustomerId,
                command.FullName,
                command.DocumentNumber,
                command.Phone,
                command.Email,
                command.Notes
            },
            cancellationToken);
    }
}
