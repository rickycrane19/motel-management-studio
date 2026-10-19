using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.FinancialLoss.Commands.RecordFinancialLossCommand;

public sealed record RecordFinancialLossCommand(
    Guid TenantId,
    Guid? LocationId,
    string CategoryCode,
    string Description,
    decimal Amount,
    string CurrencyCode = "NIO",
    int? RoomId = null,
    int? RoomStayId = null,
    int? CashBoxSessionId = null,
    int? RecordedBy = null);

public sealed class RecordFinancialLossCommandValidator : AbstractValidator<RecordFinancialLossCommand>
{
    public static readonly string[] CategoryCodes = ["Habitacion", "Minibar", "Caja", "Otro"];

    public RecordFinancialLossCommandValidator()
    {
        RuleFor(x => x.CategoryCode)
            .Must(c => CategoryCodes.Contains(c, StringComparer.OrdinalIgnoreCase))
            .WithMessage("La categoría de la pérdida debe ser Habitacion, Minibar, Caja u Otro.");
        RuleFor(x => x.Description)
            .NotEmpty().WithMessage("La descripción de la pérdida es obligatoria.")
            .MaximumLength(300).WithMessage("La descripción no puede exceder 300 caracteres.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("El monto de la pérdida debe ser mayor a cero.");
        RuleFor(x => x.CurrencyCode).NotEmpty().Length(3).WithMessage("La moneda es obligatoria (ISO de 3 letras).");
        RuleFor(x => x.CashBoxSessionId).GreaterThan(0).When(x => x.CashBoxSessionId.HasValue)
            .WithMessage("El ID de la sesión de caja no es válido.");
    }
}

public sealed class RecordFinancialLossCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(RecordFinancialLossCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@CategoryCode", command.CategoryCode);
        parameters.Add("@Description", command.Description);
        parameters.Add("@Amount", command.Amount);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@RoomId", command.RoomId);
        parameters.Add("@RoomStayId", command.RoomStayId);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@RecordedBy", command.RecordedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[Finance].[uspRecordFinancialLoss]",
            parameters,
            "@InsertedId",
            cancellationToken);
    }
}
