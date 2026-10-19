using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashSessions.Commands.CloseCashSessionCommand;

public sealed record CloseCashSessionCommand(
    Guid TenantId,
    int CashBoxSessionId,
    decimal ClosingActualBase,
    string? Notes = null);

public sealed class CloseCashSessionCommandValidator : AbstractValidator<CloseCashSessionCommand>
{
    public CloseCashSessionCommandValidator()
    {
        RuleFor(x => x.CashBoxSessionId).GreaterThan(0).WithMessage("El ID de la sesión de caja no es válido.");
        RuleFor(x => x.ClosingActualBase).GreaterThanOrEqualTo(0).WithMessage("El saldo real de cierre no puede ser negativo.");
    }
}

public sealed class CloseCashSessionCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(CloseCashSessionCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Finance].[uspCloseCashSession]",
            new
            {
                command.TenantId,
                command.CashBoxSessionId,
                command.ClosingActualBase,
                command.Notes
            },
            cancellationToken);
    }
}
