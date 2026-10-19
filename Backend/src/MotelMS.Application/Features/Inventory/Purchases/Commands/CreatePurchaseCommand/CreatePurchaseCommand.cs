using System.Data;
using System.Text.Json;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.Purchases.Commands.CreatePurchaseCommand;

public sealed record PurchaseItemInput(int ProductId, decimal Quantity, decimal UnitCost);

public sealed record CreatePurchaseCommand(
    Guid TenantId,
    Guid? LocationId,
    string PurchaseType,
    int? SupplierId = null,
    string? SupplierName = null,
    string? ReferenceDoc = null,
    int? CashBoxSessionId = null,
    string? Notes = null,
    IReadOnlyList<PurchaseItemInput>? Items = null,
    int? CreatedBy = null);

public sealed class CreatePurchaseCommandValidator : AbstractValidator<CreatePurchaseCommand>
{
    private static readonly string[] ValidTypes = ["Compra", "DevolucionProveedor"];

    public CreatePurchaseCommandValidator()
    {
        RuleFor(x => x.PurchaseType).Must(t => ValidTypes.Contains(t))
            .WithMessage("El tipo de documento debe ser Compra o DevolucionProveedor.");
        RuleFor(x => x.SupplierId).GreaterThan(0).WithMessage("El proveedor seleccionado no es válido.")
            .When(x => x.SupplierId.HasValue);
        RuleFor(x => x.SupplierName).MaximumLength(150)
            .WithMessage("El nombre del proveedor admite máximo 150 caracteres.");
        RuleFor(x => x.ReferenceDoc).MaximumLength(100)
            .WithMessage("El documento de referencia admite máximo 100 caracteres.");
        RuleFor(x => x.Notes).MaximumLength(500)
            .WithMessage("Las notas admiten máximo 500 caracteres.");
        RuleFor(x => x.Items).NotEmpty().WithMessage("Agrega al menos un producto al documento.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId).GreaterThan(0).WithMessage("Hay líneas con un ID de producto no válido.");
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Hay líneas con cantidad menor o igual a cero.");
            item.RuleFor(i => i.UnitCost).GreaterThanOrEqualTo(0).WithMessage("Hay líneas con costo negativo.");
        });
    }
}

public sealed class CreatePurchaseCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(CreatePurchaseCommand command, CancellationToken cancellationToken = default)
    {
        var items = command.Items ?? [];
        var itemsJson = JsonSerializer.Serialize(items);

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@PurchaseType", command.PurchaseType);
        parameters.Add("@SupplierId", command.SupplierId);
        parameters.Add("@SupplierName", command.SupplierName);
        parameters.Add("@ReferenceDoc", command.ReferenceDoc);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@ItemsJson", itemsJson);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Inventory].[uspCreatePurchase]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
