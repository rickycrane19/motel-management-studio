using FluentValidation;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashCounts.Commands.SaveCashBoxCountCommand;

public sealed record SaveCashBoxCountCommand(
    Guid TenantId,
    int CashBoxSessionId,
    int CountTypeId,
    int DenominationId,
    int Count,
    int? RecordedBy = null);

public sealed class SaveCashBoxCountCommandValidator : AbstractValidator<SaveCashBoxCountCommand>
{
    public SaveCashBoxCountCommandValidator()
    {
        RuleFor(x => x.CashBoxSessionId).GreaterThan(0).WithMessage("El ID de la sesión de caja no es válido.");
        RuleFor(x => x.CountTypeId).InclusiveBetween(1, 3).WithMessage("El tipo de arqueo debe ser 1 (Apertura), 2 (Pre-Arqueo) o 3 (Cierre).");
        RuleFor(x => x.DenominationId).GreaterThan(0).WithMessage("El ID de la denominación no es válido.");
        RuleFor(x => x.Count).GreaterThanOrEqualTo(0).WithMessage("La cantidad no puede ser negativa.");
    }
}

public sealed class SaveCashBoxCountCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(SaveCashBoxCountCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[Finance].[uspSaveCashBoxCount]",
            new
            {
                command.TenantId,
                command.CashBoxSessionId,
                command.CountTypeId,
                command.DenominationId,
                command.Count,
                command.RecordedBy
            },
            cancellationToken);
    }
}
