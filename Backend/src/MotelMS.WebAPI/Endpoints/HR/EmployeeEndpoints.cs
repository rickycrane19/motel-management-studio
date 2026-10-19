using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.HR.EmployeeContracts.Commands.InsertEmployeeContractCommand;
using MotelMS.Application.Features.HR.EmployeeContracts.Commands.SetEmployeeContractActiveCommand;
using MotelMS.Application.Features.HR.EmployeeContracts.Commands.UpdateEmployeeContractCommand;
using MotelMS.Application.Features.HR.EmployeeContracts.Queries.GetEmployeeContractsQuery;
using MotelMS.Application.Features.HR.Employees.Commands.InsertEmployeeCommand;
using MotelMS.Application.Features.HR.Employees.Commands.UpdateEmployeeCommand;
using MotelMS.Application.Features.HR.Employees.Queries.GetEmployeeByIdQuery;
using MotelMS.Application.Features.HR.Employees.Queries.GetEmployeesQuery;
using MotelMS.Application.Features.HR.Employees.Queries.GetEmployeeStatsQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.HR;

public sealed class EmployeeEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/hr/employees").WithTags("HR.Employees").RequireAuthorization();

        group.MapGet("/", async (
            ICurrentUserService currentUser,
            GetEmployeesQueryHandler handler,
            string? search,
            string? paymentType,
            bool? onlyActive,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
        {
            var query = new GetEmployeesQuery(
                currentUser.TenantId,
                search,
                paymentType,
                onlyActive,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        })
        .WithName("GetEmployees");

        // ── Contadores del directorio para las tarjetas de resumen ──────────────
        group.MapGet("/stats", async (
            ICurrentUserService currentUser,
            GetEmployeeStatsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetEmployeeStatsQuery(currentUser.TenantId), ct);
            return result.ToOk();
        })
        .WithName("GetEmployeeStats");

        group.MapGet("/{employeeId:int}", async (
            int employeeId,
            ICurrentUserService currentUser,
            GetEmployeeByIdQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetEmployeeByIdQuery(currentUser.TenantId, employeeId), ct);
            return result.ToOk();
        })
        .WithName("GetEmployeeById");

        group.MapPost("/", async (
            InsertEmployeeCommand command,
            IValidator<InsertEmployeeCommand> validator,
            ICurrentUserService currentUser,
            InsertEmployeeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId, LocationId = currentUser.LocationId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/hr/employees/{id}");
        })
        .WithName("InsertEmployee");

        group.MapPut("/{employeeId:int}", async (
            int employeeId,
            UpdateEmployeeCommand command,
            IValidator<UpdateEmployeeCommand> validator,
            ICurrentUserService currentUser,
            UpdateEmployeeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { EmployeeId = employeeId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        })
        .WithName("UpdateEmployee");

        // ── Contratos laborales ──────────────────────────────────────────────────
        var contracts = app.MapGroup("api/hr/contracts").WithTags("HR.EmployeeContracts").RequireAuthorization();

        contracts.MapGet("/", async (
            ICurrentUserService currentUser,
            GetEmployeeContractsQueryHandler handler,
            int? employeeId,
            bool? active,
            string? search,
            string? paymentType,
            string? status,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
        {
            var query = new GetEmployeeContractsQuery(
                currentUser.TenantId,
                employeeId,
                active,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                string.IsNullOrWhiteSpace(paymentType) ? null : paymentType.Trim(),
                string.IsNullOrWhiteSpace(status) ? null : status.Trim(),
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        })
        .WithName("GetEmployeeContracts");

        contracts.MapPost("/", async (
            InsertEmployeeContractCommand command,
            IValidator<InsertEmployeeContractCommand> validator,
            ICurrentUserService currentUser,
            InsertEmployeeContractCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/hr/contracts/{id}");
        })
        .WithName("InsertEmployeeContract");

        contracts.MapPut("/{contractId:int}", async (
            int contractId,
            UpdateEmployeeContractCommand command,
            ICurrentUserService currentUser,
            UpdateEmployeeContractCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { ContractId = contractId, TenantId = currentUser.TenantId };
            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        })
        .WithName("UpdateEmployeeContract");

        contracts.MapPut("/{contractId:int}/set-active", async (
            int contractId,
            SetEmployeeContractActiveRequest request,
            SetEmployeeContractActiveRequestValidator validator,
            ICurrentUserService currentUser,
            SetEmployeeContractActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(new SetEmployeeContractActiveCommand(currentUser.TenantId, contractId, request.IsActive), ct);
            return result.ToNoContent();
        })
        .WithName("SetEmployeeContractActive");
    }
}

/// <summary>Valida el cuerpo del activar/desactivar contrato antes de mapearlo al comando.</summary>
public sealed class SetEmployeeContractActiveRequestValidator : AbstractValidator<SetEmployeeContractActiveRequest>
{
    public SetEmployeeContractActiveRequestValidator()
    {
        RuleFor(x => x.IsActive).NotNull().WithMessage("Debes indicar el estado del contrato.");
    }
}
