using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashSessions.Commands.OpenCashSessionCommand;

public sealed record OpenCashSessionCommand(
    Guid TenantId,
    Guid? LocationId,
    int CashBoxId,
    int UserId,
    string ShiftName,
    decimal OpeningBalanceBase = 0,
    string? Notes = null);

public sealed class OpenCashSessionCommandValidator : AbstractValidator<OpenCashSessionCommand>
{
    public OpenCashSessionCommandValidator()
    {
        RuleFor(x => x.CashBoxId).GreaterThan(0).WithMessage("Debes seleccionar una caja registradora válida.");
        RuleFor(x => x.UserId).GreaterThan(0).WithMessage("El ID de usuario es obligatorio.");
        RuleFor(x => x.ShiftName).NotEmpty().WithMessage("El nombre o identificación del turno es obligatorio.");
        RuleFor(x => x.OpeningBalanceBase).GreaterThanOrEqualTo(0).WithMessage("El saldo inicial no puede ser negativo.");
    }
}

public sealed class OpenCashSessionCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(OpenCashSessionCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@CashBoxId", command.CashBoxId);
        parameters.Add("@UserId", command.UserId);
        parameters.Add("@ShiftName", command.ShiftName);
        parameters.Add("@OpeningBalanceBase", command.OpeningBalanceBase);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Finance].[uspOpenCashSession]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
