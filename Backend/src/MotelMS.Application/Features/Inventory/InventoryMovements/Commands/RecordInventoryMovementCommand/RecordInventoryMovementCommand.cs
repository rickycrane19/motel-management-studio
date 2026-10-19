using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.InventoryMovements.Commands.RecordInventoryMovementCommand;

public sealed record RecordInventoryMovementCommand(
    Guid TenantId,
    Guid? LocationId,
    int ProductId,
    string MovementType,
    decimal Quantity,
    decimal? UnitCost = null,
    string? Reason = null,
    string? ReferenceDoc = null,
    int? CreatedBy = null);

public sealed class RecordInventoryMovementCommandValidator : AbstractValidator<RecordInventoryMovementCommand>
{
    private static readonly string[] ValidTypes = ["Compra", "Venta", "AjusteEntrada", "AjusteSalida", "DevolucionProveedor", "DevolucionCliente"];

    public RecordInventoryMovementCommandValidator()
    {
        RuleFor(x => x.ProductId).GreaterThan(0).WithMessage("El ID del producto no es válido.");
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("La cantidad debe ser mayor a cero.");
        RuleFor(x => x.MovementType).Must(t => ValidTypes.Contains(t))
            .WithMessage("El tipo de movimiento debe ser: Compra, Venta, AjusteEntrada, AjusteSalida, DevolucionProveedor o DevolucionCliente.");
    }
}

public sealed class RecordInventoryMovementCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(RecordInventoryMovementCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@ProductId", command.ProductId);
        parameters.Add("@MovementType", command.MovementType);
        parameters.Add("@Quantity", command.Quantity);
        parameters.Add("@UnitCost", command.UnitCost);
        parameters.Add("@Reason", command.Reason);
        parameters.Add("@ReferenceDoc", command.ReferenceDoc);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Inventory].[uspRecordInventoryMovement]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
