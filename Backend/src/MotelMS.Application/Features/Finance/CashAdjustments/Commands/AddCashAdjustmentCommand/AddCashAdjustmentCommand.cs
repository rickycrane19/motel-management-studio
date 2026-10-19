using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashAdjustments.Commands.AddCashAdjustmentCommand;

public sealed record AddCashAdjustmentCommand(
    Guid TenantId,
    int CashBoxSessionId,
    string AdjustmentType,
    string CurrencyCode,
    decimal Amount,
    string Reason,
    string SourceCode = AddCashAdjustmentCommand.DefaultSourceCode,
    int? RecordedBy = null)
{
    /// <summary>Fuente del ajuste. Solo se aceptan estas cuatro clases desde el endpoint manual.</summary>
    public const string DefaultSourceCode = "AjusteManual";

    public static readonly string[] AllowedSourceCodes = ["AjusteManual", "Propina", "Comision", "Otro"];
}

public sealed class AddCashAdjustmentCommandValidator : AbstractValidator<AddCashAdjustmentCommand>
{
    public AddCashAdjustmentCommandValidator()
    {
        RuleFor(x => x.CashBoxSessionId).GreaterThan(0).WithMessage("El ID de la sesión de caja no es válido.");
        RuleFor(x => x.AdjustmentType).Must(t => t == "IN" || t == "OUT")
            .WithMessage("El tipo de ajuste debe ser IN (Entrada) o OUT (Salida).");
        RuleFor(x => x.CurrencyCode).NotEmpty().Length(3).WithMessage("La moneda es obligatoria (ISO de 3 letras).");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("El monto del ajuste debe ser mayor a cero.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("El motivo o justificación del ajuste es obligatorio.");
        RuleFor(x => x.SourceCode)
            .Must(code => code is not null && AddCashAdjustmentCommand.AllowedSourceCodes.Contains(code))
            .WithMessage("La fuente del ajuste debe ser AjusteManual, Propina, Comision u Otro.");
    }
}

public sealed class AddCashAdjustmentCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(AddCashAdjustmentCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@AdjustmentType", command.AdjustmentType);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@Amount", command.Amount);
        parameters.Add("@Reason", command.Reason);
        parameters.Add("@SourceCode", string.IsNullOrWhiteSpace(command.SourceCode)
            ? AddCashAdjustmentCommand.DefaultSourceCode
            : command.SourceCode);
        parameters.Add("@RecordedBy", command.RecordedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Finance].[uspAddCashAdjustment]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
