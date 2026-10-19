using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Service.FineTypes.Commands.InsertFineTypeCommand;

public sealed record InsertFineTypeCommand(
    Guid TenantId,
    string Name,
    string? Description = null,
    decimal DefaultAmount = 0);

public sealed class InsertFineTypeCommandValidator : AbstractValidator<InsertFineTypeCommand>
{
    public InsertFineTypeCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(120).WithMessage("El nombre del tipo de multa es obligatorio.");
        RuleFor(x => x.DefaultAmount).GreaterThanOrEqualTo(0).WithMessage("El monto por defecto no puede ser negativo.");
    }
}

public sealed class InsertFineTypeCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertFineTypeCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new Dapper.DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@Name", command.Name);
        parameters.Add("@Description", command.Description);
        parameters.Add("@DefaultAmount", command.DefaultAmount);
        parameters.Add("@InsertedId", dbType: System.Data.DbType.Int32, direction: System.Data.ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Service].[uspInsertFineType]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
