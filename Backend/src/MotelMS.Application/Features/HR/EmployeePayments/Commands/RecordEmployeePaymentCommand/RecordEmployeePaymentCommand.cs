using System.Data;
using System.Text.Json;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeePayments.Commands.RecordEmployeePaymentCommand;

/// <summary>Deducción detallada de un pago (INSS, IR, Préstamo, Adelanto, Otro).</summary>
public sealed record EmployeeDeductionInput(string Type, string? Description, decimal Amount);

public sealed record RecordEmployeePaymentCommand(
    Guid TenantId,
    Guid? LocationId,
    int EmployeeId,
    string PaymentType,
    DateTime PeriodStart,
    DateTime PeriodEnd,
    decimal UnitsWorked,
    decimal RateApplied,
    decimal BonusAmount = 0,
    decimal DeductionsAmount = 0,
    string CurrencyCode = "NIO",
    // Turno extra pagado fuera del contrato vigente (por día u hora).
    bool IsExtraShift = false,
    // Deducciones detalladas; si vienen, el SP calcula DeductionsAmount como su suma.
    IReadOnlyList<EmployeeDeductionInput>? Deductions = null,
    // Sesión de caja del turno desde la que sale el efectivo (turno extra pagado
    // aparte). Cuando viene > 0 el SP crea el egreso 'Pago de nómina' con el NETO en caja.
    int? CashBoxSessionId = null,
    string? Notes = null,
    int? CreatedBy = null);

public sealed class RecordEmployeePaymentCommandValidator : AbstractValidator<RecordEmployeePaymentCommand>
{
    private static readonly string[] AllowedDeductionTypes = ["INSS", "IR", "Prestamo", "Adelanto", "Otro"];

    public RecordEmployeePaymentCommandValidator()
    {
        RuleFor(x => x.UnitsWorked).GreaterThan(0).WithMessage("Las unidades trabajadas deben ser mayores a cero.");
        RuleFor(x => x.RateApplied).GreaterThanOrEqualTo(0).WithMessage("La tarifa aplicada no puede ser negativa.");
        RuleFor(x => x.PeriodEnd)
            .GreaterThanOrEqualTo(x => x.PeriodStart)
            .WithMessage("La fecha de fin del periodo no puede ser anterior a la fecha de inicio.");
        RuleFor(x => x.DeductionsAmount).GreaterThanOrEqualTo(0).WithMessage("Las deducciones no pueden ser negativas.");

        RuleForEach(x => x.Deductions).ChildRules(deduction =>
        {
            deduction.RuleFor(d => d.Type)
                .Must(type => AllowedDeductionTypes.Contains(type))
                .WithMessage("Tipo de deducción no válido. Solo se aceptan INSS, IR, Préstamo, Adelanto u Otro.");
            deduction.RuleFor(d => d.Amount)
                .GreaterThanOrEqualTo(0)
                .WithMessage("Cada deducción debe indicar un monto mayor o igual a cero.");
            deduction.RuleFor(d => d.Description)
                .MaximumLength(200)
                .WithMessage("La descripción de la deducción admite máximo 200 caracteres.");
        });
    }
}

public sealed class RecordEmployeePaymentCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(RecordEmployeePaymentCommand command, CancellationToken cancellationToken = default)
    {
        var deductionsJson = command.Deductions is { Count: > 0 }
            ? JsonSerializer.Serialize(command.Deductions.Select(d => new
            {
                type = d.Type,
                description = d.Description,
                amount = d.Amount
            }))
            : null;

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@EmployeeId", command.EmployeeId);
        parameters.Add("@PaymentType", command.PaymentType);
        parameters.Add("@PeriodStart", command.PeriodStart);
        parameters.Add("@PeriodEnd", command.PeriodEnd);
        parameters.Add("@UnitsWorked", command.UnitsWorked);
        parameters.Add("@RateApplied", command.RateApplied);
        parameters.Add("@BonusAmount", command.BonusAmount);
        parameters.Add("@DeductionsAmount", command.DeductionsAmount);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@IsExtraShift", command.IsExtraShift);
        parameters.Add("@Deductions", deductionsJson);
        parameters.Add("@CashBoxSessionId", command.CashBoxSessionId);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[HR].[uspRecordEmployeePayment]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
