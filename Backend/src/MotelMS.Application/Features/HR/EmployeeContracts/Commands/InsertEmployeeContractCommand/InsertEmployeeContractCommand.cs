using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeeContracts.Commands.InsertEmployeeContractCommand;

public sealed record InsertEmployeeContractCommand(
    Guid TenantId,
    int EmployeeId,
    string Position,
    string PaymentType,
    decimal BaseAmount,
    DateTime StartDate,
    DateTime? EndDate = null,
    string CurrencyCode = "NIO",
    string? ScheduleNotes = null,
    string? Notes = null,
    int? CreatedBy = null);

public sealed class InsertEmployeeContractCommandValidator : AbstractValidator<InsertEmployeeContractCommand>
{
    private static readonly string[] AllowedPaymentTypes = ["Hourly", "Daily", "PerShift", "Weekly", "Monthly"];

    public InsertEmployeeContractCommandValidator()
    {
        RuleFor(x => x.EmployeeId).GreaterThan(0).WithMessage("El empleado del contrato es obligatorio.");
        RuleFor(x => x.Position).NotEmpty().WithMessage("El puesto del contrato es obligatorio.");
        RuleFor(x => x.PaymentType)
            .NotEmpty().WithMessage("La modalidad de pago es obligatoria.")
            .Must(AllowedPaymentTypes.Contains)
            .WithMessage("La modalidad de pago no es válida. Debe ser Hourly, Daily, PerShift, Weekly o Monthly.");
        RuleFor(x => x.BaseAmount).GreaterThanOrEqualTo(0).WithMessage("El monto base del contrato no puede ser negativo.");
    }
}

public sealed class InsertEmployeeContractCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertEmployeeContractCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@EmployeeId", command.EmployeeId);
        parameters.Add("@Position", command.Position);
        parameters.Add("@PaymentType", command.PaymentType);
        parameters.Add("@BaseAmount", command.BaseAmount);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@StartDate", command.StartDate);
        parameters.Add("@EndDate", command.EndDate);
        parameters.Add("@ScheduleNotes", command.ScheduleNotes);
        parameters.Add("@Notes", command.Notes);
        parameters.Add("@CreatedBy", command.CreatedBy);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[HR].[uspInsertEmployeeContract]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
