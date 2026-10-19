using Carter;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.HR.CommissionRules.Commands.InsertCommissionRuleCommand;
using MotelMS.Application.Features.HR.CommissionRules.Commands.SetCommissionRuleActiveCommand;
using MotelMS.Application.Features.HR.CommissionRules.Commands.UpdateCommissionRuleCommand;
using MotelMS.Application.Features.HR.CommissionRules.Queries.GetCommissionRuleByIdQuery;
using MotelMS.Application.Features.HR.CommissionRules.Queries.GetCommissionRulesQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.HR;

/// <summary>
/// Reglas de comisión con reglas múltiples (por empleado, por puesto/rol o generales, con tramos
/// de monto por métrica y vigencia). Alimentan la comisión del reporte de rendimiento por cajero.
/// </summary>
public sealed class CommissionRuleEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/hr/commission-rules").WithTags("HR.CommissionRules").RequireAuthorization();

        // ── Listado paginado de reglas (con alcance resuelto) ────────────────────────
        group.MapGet("/", async (
            string? search,
            bool? onlyActive,
            string? scopeType,
            string? metricType,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetCommissionRulesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCommissionRulesQuery(
                currentUser.TenantId,
                search,
                onlyActive,
                scopeType,
                metricType,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        })
        .WithName("GetCommissionRules");

        // ── Detalle de una regla ─────────────────────────────────────────────────────
        group.MapGet("/{ruleId:int}", async (
            int ruleId,
            ICurrentUserService currentUser,
            GetCommissionRuleByIdQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCommissionRuleByIdQuery(currentUser.TenantId, ruleId), ct);
            return result.Match(value => value is null ? Results.NotFound() : Results.Ok(value));
        })
        .WithName("GetCommissionRuleById");

        // ── Alta de una regla ────────────────────────────────────────────────────────
        group.MapPost("/", async (
            InsertCommissionRuleCommand command,
            IValidator<InsertCommissionRuleCommand> validator,
            ICurrentUserService currentUser,
            InsertCommissionRuleCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId, CreatedBy = currentUser.UserId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/hr/commission-rules/{id}");
        })
        .WithName("InsertCommissionRule");

        // ── Edición de una regla ─────────────────────────────────────────────────────
        group.MapPut("/{ruleId:int}", async (
            int ruleId,
            UpdateCommissionRuleCommand command,
            IValidator<UpdateCommissionRuleCommand> validator,
            ICurrentUserService currentUser,
            UpdateCommissionRuleCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { RuleId = ruleId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        })
        .WithName("UpdateCommissionRule");

        // ── Activar / desactivar una regla ───────────────────────────────────────────
        group.MapPut("/{ruleId:int}/set-active", async (
            int ruleId,
            SetCommissionRuleActiveRequest request,
            ICurrentUserService currentUser,
            SetCommissionRuleActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(
                new SetCommissionRuleActiveCommand(currentUser.TenantId, ruleId, request.IsActive), ct);
            return result.ToNoContent();
        })
        .WithName("SetCommissionRuleActive");
    }
}
