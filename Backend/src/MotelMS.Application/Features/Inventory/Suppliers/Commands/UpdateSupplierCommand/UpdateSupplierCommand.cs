using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Suppliers.Commands.UpdateSupplierCommand;

public sealed record UpdateSupplierCommand(
    Guid TenantId,
    int SupplierId,
    string Name,
    string? ContactName = null,
    string? Phone = null,
    string? Email = null,
    string? Address = null,
    string? TaxId = null,
    string? Notes = null);

public sealed class UpdateSupplierCommandValidator : AbstractValidator<UpdateSupplierCommand>
{
    public UpdateSupplierCommandValidator()
    {
        RuleFor(x => x.SupplierId).GreaterThan(0).WithMessage("El ID del proveedor no es válido.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre del proveedor es obligatorio.")
            .MaximumLength(150).WithMessage("El nombre del proveedor admite máximo 150 caracteres.");
        RuleFor(x => x.ContactName).MaximumLength(150).WithMessage("El contacto admite máximo 150 caracteres.");
        RuleFor(x => x.Phone).MaximumLength(50).WithMessage("El teléfono admite máximo 50 caracteres.");
        RuleFor(x => x.Email).MaximumLength(150).WithMessage("El correo admite máximo 150 caracteres.")
            .EmailAddress().WithMessage("El correo del proveedor no tiene un formato válido.")
            .When(x => !string.IsNullOrWhiteSpace(x.Email));
        RuleFor(x => x.Address).MaximumLength(250).WithMessage("La dirección admite máximo 250 caracteres.");
        RuleFor(x => x.TaxId).MaximumLength(50).WithMessage("El RUC admite máximo 50 caracteres.");
        RuleFor(x => x.Notes).MaximumLength(500).WithMessage("Las notas admiten máximo 500 caracteres.");
    }
}

public sealed class UpdateSupplierCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateSupplierCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Inventory].[uspUpdateSupplier]",
            new
            {
                command.TenantId,
                command.SupplierId,
                command.Name,
                command.ContactName,
                command.Phone,
                command.Email,
                command.Address,
                command.TaxId,
                command.Notes
            },
            cancellationToken);
    }
}
