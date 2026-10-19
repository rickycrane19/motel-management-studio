using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using FluentValidation;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Products.Commands.SetProductActiveCommand;

public sealed record SetProductActiveCommand(
    Guid TenantId,
    int ProductId,
    bool IsActive);

public sealed class SetProductActiveCommandValidator : AbstractValidator<SetProductActiveCommand>
{
    public SetProductActiveCommandValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0).WithMessage("El ID del producto no es válido.");
    }
}

public sealed class SetProductActiveCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SetProductActiveCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Inventory].[uspSetProductActive]",
            new
            {
                command.TenantId,
                command.ProductId,
                command.IsActive
            },
            cancellationToken);
    }
}
