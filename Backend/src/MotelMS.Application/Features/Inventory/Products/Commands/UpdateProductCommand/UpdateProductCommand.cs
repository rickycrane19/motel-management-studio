using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Products.Commands.UpdateProductCommand;

public sealed record UpdateProductCommand(
    Guid TenantId,
    int ProductId,
    int CategoryId,
    string Code,
    string Name,
    string? Description,
    decimal CostPrice,
    decimal SalePrice,
    decimal MinStock = 5,
    string UnitOfMeasure = "UND",
    string? ImageUrl = null);

public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0).WithMessage("El ID del producto no es válido.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre del producto es obligatorio.");
        RuleFor(x => x.Code).NotEmpty().WithMessage("El código del producto es obligatorio.");
        RuleFor(x => x.CategoryId).GreaterThan(0).WithMessage("Debes seleccionar una categoría válida.");
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0).WithMessage("El precio de costo no puede ser negativo.");
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0).WithMessage("El precio de venta no puede ser negativo.");
    }
}

public sealed class UpdateProductCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateProductCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Inventory].[uspUpdateProduct]",
            new
            {
                command.TenantId,
                command.ProductId,
                command.CategoryId,
                command.Code,
                command.Name,
                command.Description,
                command.CostPrice,
                command.SalePrice,
                command.MinStock,
                command.UnitOfMeasure,
                command.ImageUrl
            },
            cancellationToken);
    }
}
