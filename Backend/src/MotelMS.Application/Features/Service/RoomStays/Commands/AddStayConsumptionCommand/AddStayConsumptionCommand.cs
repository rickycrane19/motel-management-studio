using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.RoomStays.Commands.AddStayConsumptionCommand;

public sealed record AddStayConsumptionCommand(
    Guid TenantId,
    int RoomStayId,
    int ProductId,
    decimal Quantity,
    int? CreatedBy = null,
    string? Notes = null);

public sealed class AddStayConsumptionCommandValidator : AbstractValidator<AddStayConsumptionCommand>
{
    public AddStayConsumptionCommandValidator()
    {
        RuleFor(x => x.RoomStayId).GreaterThan(0);
        RuleFor(x => x.ProductId).GreaterThan(0);
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("La cantidad debe ser mayor a 0.");
    }
}

public sealed class AddStayConsumptionCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(AddStayConsumptionCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@RoomStayId", command.RoomStayId);
        parameters.Add("@ProductId", command.ProductId);
        parameters.Add("@Quantity", command.Quantity);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspAddStayConsumption]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
