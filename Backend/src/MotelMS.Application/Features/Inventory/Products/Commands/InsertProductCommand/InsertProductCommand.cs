using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Products.Commands.InsertProductCommand;

public sealed record InsertProductCommand(
    Guid TenantId,
    Guid? LocationId,
    int CategoryId,
    string Code,
    string Name,
    string? Description,
    decimal CostPrice,
    decimal SalePrice,
    decimal CurrentStock = 0,
    decimal MinStock = 5,
    string UnitOfMeasure = "UND",
    string? ImageUrl = null,
    int? CreatedBy = null);

public sealed class InsertProductCommandValidator : AbstractValidator<InsertProductCommand>
{
    public InsertProductCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre del producto es obligatorio.");
        RuleFor(x => x.Code).NotEmpty().WithMessage("El código del producto es obligatorio.");
        RuleFor(x => x.CategoryId).GreaterThan(0).WithMessage("Debes seleccionar una categoría válida.");
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0).WithMessage("El precio de costo no puede ser negativo.");
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0).WithMessage("El precio de venta no puede ser negativo.");
    }
}

public sealed class InsertProductCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertProductCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@CategoryId", command.CategoryId);
        parameters.Add("@Code", command.Code);
        parameters.Add("@Name", command.Name);
        parameters.Add("@Description", command.Description);
        parameters.Add("@CostPrice", command.CostPrice);
        parameters.Add("@SalePrice", command.SalePrice);
        parameters.Add("@CurrentStock", command.CurrentStock);
        parameters.Add("@MinStock", command.MinStock);
        parameters.Add("@UnitOfMeasure", command.UnitOfMeasure);
        parameters.Add("@ImageUrl", command.ImageUrl);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Inventory].[uspInsertProduct]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
