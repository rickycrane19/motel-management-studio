using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Suppliers.Commands.SetSupplierActiveCommand;

public sealed record SetSupplierActiveCommand(
    Guid TenantId,
    int SupplierId,
    bool IsActive);

public sealed class SetSupplierActiveCommandValidator : AbstractValidator<SetSupplierActiveCommand>
{
    public SetSupplierActiveCommandValidator()
    {
        RuleFor(x => x.SupplierId).GreaterThan(0).WithMessage("El ID del proveedor no es válido.");
    }
}

public sealed class SetSupplierActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetSupplierActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Inventory].[uspSetSupplierActive]",
            new
            {
                command.TenantId,
                command.SupplierId,
                command.IsActive
            },
            cancellationToken);
    }
}
