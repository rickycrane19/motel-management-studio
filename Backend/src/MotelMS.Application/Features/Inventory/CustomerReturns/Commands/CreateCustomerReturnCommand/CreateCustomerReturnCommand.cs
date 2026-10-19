using System.Data;
using System.Text.Json;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Inventory.CustomerReturns.Commands.CreateCustomerReturnCommand;

public sealed record CustomerReturnItemInput(int ProductId, decimal Quantity, decimal UnitPrice);

public sealed record CreateCustomerReturnCommand(
    Guid TenantId,
    Guid? LocationId,
    string? CustomerName = null,
    int? RoomStayId = null,
    int? CashBoxSessionId = null,
    string? Notes = null,
    IReadOnlyList<CustomerReturnItemInput>? Items = null,
    int? CreatedBy = null);

public sealed class CreateCustomerReturnCommandValidator : AbstractValidator<CreateCustomerReturnCommand>
{
    public CreateCustomerReturnCommandValidator()
    {
        RuleFor(x => x.CustomerName).MaximumLength(150)
            .WithMessage("El nombre del cliente admite máximo 150 caracteres.");
        RuleFor(x => x.Notes).MaximumLength(500)
            .WithMessage("Las notas admiten máximo 500 caracteres.");
        RuleFor(x => x.Items).NotEmpty().WithMessage("Agrega al menos un producto a la devolución.");
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId).GreaterThan(0).WithMessage("Hay líneas con un ID de producto no válido.");
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Hay líneas con cantidad menor o igual a cero.");
            item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("Hay líneas con precio negativo.");
        });
    }
}

public sealed class CreateCustomerReturnCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(CreateCustomerReturnCommand command, CancellationToken cancellationToken = default)
    {
        var items = command.Items ?? [];
        var itemsJson = JsonSerializer.Serialize(items);

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@CustomerName", command.CustomerName);
        parameters.Add("@RoomStayId", command.RoomStayId);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@ItemsJson", itemsJson);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Inventory].[uspCreateCustomerReturn]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
