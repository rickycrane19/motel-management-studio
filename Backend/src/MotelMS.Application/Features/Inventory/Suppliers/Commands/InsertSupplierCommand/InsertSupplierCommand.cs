using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Suppliers.Commands.InsertSupplierCommand;

public sealed record InsertSupplierCommand(
    Guid TenantId,
    Guid? LocationId,
    string Name,
    string? ContactName = null,
    string? Phone = null,
    string? Email = null,
    string? Address = null,
    string? TaxId = null,
    string? Notes = null,
    int? CreatedBy = null);

public sealed class InsertSupplierCommandValidator : AbstractValidator<InsertSupplierCommand>
{
    public InsertSupplierCommandValidator()
    {
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

public sealed class InsertSupplierCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertSupplierCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@Name", command.Name);
        parameters.Add("@ContactName", command.ContactName);
        parameters.Add("@Phone", command.Phone);
        parameters.Add("@Email", command.Email);
        parameters.Add("@Address", command.Address);
        parameters.Add("@TaxId", command.TaxId);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Inventory].[uspInsertSupplier]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
