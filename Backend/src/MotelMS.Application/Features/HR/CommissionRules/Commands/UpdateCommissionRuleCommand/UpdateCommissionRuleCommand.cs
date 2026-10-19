using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.CommissionRules.Commands.UpdateCommissionRuleCommand;

public sealed record UpdateCommissionRuleCommand(
    Guid TenantId,
    int RuleId,
    string Name,
    string ScopeType,
    string MetricType = "Sales",
    decimal MinAmount = 0,
    decimal? MaxAmount = null,
    decimal RatePercent = 0,
    DateTime StartDate = default,
    DateTime? EndDate = null,
    int? EmployeeId = null,
    string? Position = null,
    string? Notes = null);

public sealed class UpdateCommissionRuleCommandValidator : AbstractValidator<UpdateCommissionRuleCommand>
{
    private static readonly string[] AllowedScopes = ["Employee", "Position", "All"];
    private static readonly string[] AllowedMetrics = ["Sales", "Stays", "Products", "Tips"];

    public UpdateCommissionRuleCommandValidator()
    {
        RuleFor(x => x.RuleId).GreaterThan(0).WithMessage("La regla de comisión indicada no es válida.");
        RuleFor(x => x.Name).NotEmpty().WithMessage("El nombre de la regla de comisión es obligatorio.")
            .MaximumLength(120).WithMessage("El nombre de la regla admite máximo 120 caracteres.");
        RuleFor(x => x.ScopeType)
            .NotEmpty().WithMessage("El alcance de la regla es obligatorio.")
            .Must(AllowedScopes.Contains)
            .WithMessage("El alcance de la regla no es válido. Debe ser Employee, Position o All.");
        RuleFor(x => x.MetricType)
            .NotEmpty().WithMessage("La métrica de la regla es obligatoria.")
            .Must(AllowedMetrics.Contains)
            .WithMessage("La métrica de la regla no es válida. Debe ser Sales, Stays, Products o Tips.");
        RuleFor(x => x.RatePercent)
            .InclusiveBetween(0, 100).WithMessage("El porcentaje de comisión debe estar entre 0 y 100.");
        RuleFor(x => x.MinAmount)
            .GreaterThanOrEqualTo(0).WithMessage("El monto mínimo del tramo no puede ser negativo.");
        RuleFor(x => x.MaxAmount)
            .GreaterThan(x => x.MinAmount).WithMessage("El monto máximo del tramo debe ser mayor que el mínimo.")
            .When(x => x.MaxAmount.HasValue);
        RuleFor(x => x.StartDate)
            .NotEmpty().WithMessage("La fecha de inicio de vigencia es obligatoria.");
        RuleFor(x => x.EndDate)
            .GreaterThanOrEqualTo(x => x.StartDate).WithMessage("La fecha de fin no puede ser anterior a la fecha de inicio.")
            .When(x => x.EndDate.HasValue);
        RuleFor(x => x.EmployeeId)
            .NotNull().GreaterThan(0).WithMessage("Para una regla por empleado debes indicar el empleado.")
            .When(x => x.ScopeType == "Employee");
        RuleFor(x => x.Position)
            .NotEmpty().WithMessage("Para una regla por puesto debes indicar el puesto.")
            .When(x => x.ScopeType == "Position");
        RuleFor(x => x.Notes).MaximumLength(300).WithMessage("Las notas admiten máximo 300 caracteres.");
    }
}

public sealed class UpdateCommissionRuleCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateCommissionRuleCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[HR].[uspUpdateCommissionRule]",
            new
            {
                command.TenantId,
                command.RuleId,
                command.Name,
                command.ScopeType,
                command.EmployeeId,
                command.Position,
                command.MetricType,
                command.MinAmount,
                command.MaxAmount,
                command.RatePercent,
                command.StartDate,
                command.EndDate,
                command.Notes
            },
            cancellationToken);
    }
}
