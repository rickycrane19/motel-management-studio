using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.Employees.Commands.UpdateEmployeeCommand;

public sealed record UpdateEmployeeCommand(
    Guid TenantId,
    int EmployeeId,
    string FullName,
    string Position,
    string PaymentType,
    decimal Rate,
    decimal CommissionRatePercent = 0,
    string CurrencyCode = "NIO",
    string? Phone = null);

public sealed class UpdateEmployeeCommandValidator : AbstractValidator<UpdateEmployeeCommand>
{
    public UpdateEmployeeCommandValidator()
    {
        RuleFor(x => x.EmployeeId).GreaterThan(0).WithMessage("El empleado indicado no existe.");
        RuleFor(x => x.FullName).NotEmpty().WithMessage("El nombre del empleado es obligatorio.");
        RuleFor(x => x.Position).NotEmpty().WithMessage("El puesto del empleado es obligatorio.");
        RuleFor(x => x.Rate).GreaterThanOrEqualTo(0).WithMessage("La tarifa de pago no puede ser negativa.");
        RuleFor(x => x.CommissionRatePercent).InclusiveBetween(0, 100)
            .WithMessage("La comisión sobre ventas debe estar entre 0 y 100 por ciento.");
    }
}

public sealed class UpdateEmployeeCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateEmployeeCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[HR].[uspUpdateEmployee]",
            new
            {
                command.TenantId,
                command.EmployeeId,
                command.FullName,
                command.Position,
                command.PaymentType,
                command.Rate,
                command.CommissionRatePercent,
                command.CurrencyCode,
                command.Phone
            },
            cancellationToken);
    }
}
