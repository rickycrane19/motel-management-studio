using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.EmployeeContracts.Commands.UpdateEmployeeContractCommand;

public sealed record UpdateEmployeeContractCommand(
    Guid TenantId,
    int ContractId,
    int EmployeeId,
    string Position,
    string PaymentType,
    decimal BaseAmount,
    DateTime StartDate,
    DateTime? EndDate = null,
    string CurrencyCode = "NIO",
    string? ScheduleNotes = null,
    string? Notes = null);

public sealed class UpdateEmployeeContractCommandHandler(ISqlConnector connector)
{
    public async Task<Result> HandleAsync(UpdateEmployeeContractCommand command, CancellationToken cancellationToken = default)
    {
        return await DmlRunner.ExecuteAsync(
            connector,
            "[HR].[uspUpdateEmployeeContract]",
            new
            {
                command.TenantId,
                command.ContractId,
                command.Position,
                command.PaymentType,
                command.BaseAmount,
                command.CurrencyCode,
                command.StartDate,
                command.EndDate,
                command.ScheduleNotes,
                command.Notes
            },
            cancellationToken);
    }
}
