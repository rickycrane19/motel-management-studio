using System.Data;
using Dapper;
using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.Employees.Commands.InsertEmployeeCommand;

public sealed record InsertEmployeeCommand(
    Guid TenantId,
    Guid? LocationId,
    string FullName,
    string Position,
    string PaymentType,
    decimal Rate,
    decimal CommissionRatePercent = 0,
    string CurrencyCode = "NIO",
    string? Phone = null);

public sealed class InsertEmployeeCommandValidator : AbstractValidator<InsertEmployeeCommand>
{
    private static readonly string[] AllowedPaymentTypes = ["Hourly", "Daily", "PerShift", "Weekly", "Monthly"];

    public InsertEmployeeCommandValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("El nombre del empleado es obligatorio.");
        RuleFor(x => x.Position).NotEmpty().WithMessage("El puesto del empleado es obligatorio.");
        RuleFor(x => x.PaymentType)
            .NotEmpty().WithMessage("La modalidad de pago es obligatoria.")
            .Must(AllowedPaymentTypes.Contains)
            .WithMessage("La modalidad de pago no es válida. Debe ser Hourly, Daily, PerShift, Weekly o Monthly.");
        RuleFor(x => x.Rate).GreaterThanOrEqualTo(0).WithMessage("La tarifa de pago no puede ser negativa.");
        RuleFor(x => x.CommissionRatePercent).InclusiveBetween(0, 100)
            .WithMessage("La comisión sobre ventas debe estar entre 0 y 100 por ciento.");
    }
}

public sealed class InsertEmployeeCommandHandler(ISqlConnector connector)
{
    public async Task<Result<int>> HandleAsync(InsertEmployeeCommand command, CancellationToken cancellationToken = default)
    {
        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", command.TenantId);
        parameters.Add("@LocationId", command.LocationId);
        parameters.Add("@FullName", command.FullName);
        parameters.Add("@Position", command.Position);
        parameters.Add("@PaymentType", command.PaymentType);
        parameters.Add("@Rate", command.Rate);
        parameters.Add("@CommissionRatePercent", command.CommissionRatePercent);
        parameters.Add("@CurrencyCode", command.CurrencyCode);
        parameters.Add("@Phone", command.Phone);
        parameters.Add("@InsertedId", dbType: DbType.Int32, direction: ParameterDirection.Output);

        return await DmlRunner.ExecuteReturningIdAsync(
            connector,
            "[HR].[uspInsertEmployee]",
            parameters,
            cancellationToken: cancellationToken);
    }
}
