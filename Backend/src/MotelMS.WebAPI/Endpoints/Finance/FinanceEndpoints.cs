using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Finance.CashAdjustments.Commands.AddCashAdjustmentCommand;
using MotelMS.Application.Features.Finance.CashBox.Queries.GetCashBoxesQuery;
using MotelMS.Application.Features.Finance.CashCounts.Commands.SaveCashBoxCountCommand;
using MotelMS.Application.Features.Finance.CashSessions.Commands.CloseCashSessionCommand;
using MotelMS.Application.Features.Finance.CashSessions.Commands.OpenCashSessionCommand;
using MotelMS.Application.Features.Finance.CashSessions.Queries.GetActiveCashSessionQuery;
using MotelMS.Application.Features.Finance.CashSessions.Queries.GetCashBoxSessionsQuery;
using MotelMS.Application.Features.Finance.CashSessions.Queries.GetCashSessionSummaryQuery;
using MotelMS.Application.Features.Finance.Denominations.Queries.GetDenominationsQuery;
using MotelMS.WebAPI.Extensions;
using MotelMS.WebAPI.Realtime;

namespace MotelMS.WebAPI.Endpoints.Finance;

public sealed class FinanceEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/finance").WithTags("Finance").RequireAuthorization();

        // ── Cajas físicas ────────────────────────────────────────────────────────
        group.MapGet("/cashboxes", async (
            ICurrentUserService currentUser,
            GetCashBoxesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCashBoxesQuery(currentUser.TenantId), ct);
            return result.ToOk();
        });

        // ── Denominaciones de billetes y monedas ─────────────────────────────────
        group.MapGet("/denominations", async (
            ICurrentUserService currentUser,
            GetDenominationsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetDenominationsQuery(currentUser.TenantId), ct);
            return result.ToOk();
        });

        // ── Sesión de caja activa del usuario/sucursal ───────────────────────────
        group.MapGet("/sessions/active", async (
            int? cashBoxId,
            ICurrentUserService currentUser,
            GetActiveCashSessionQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetActiveCashSessionQuery(currentUser.TenantId, currentUser.UserId, cashBoxId), ct);
            return result.ToOk();
        });

        // ── Historial paginado de turnos/sesiones con su reconciliación ──────────
        // Sin from/to el backend asume los últimos 30 días del negocio (America/Managua)
        // y devuelve el rango UTC realmente aplicado para que el UI lo muestre.
        group.MapGet("/sessions", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            int? cashBoxId,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetCashBoxSessionsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCashBoxSessionsQuery(
                currentUser.TenantId,
                from?.UtcDateTime,
                to?.UtcDateTime,
                cashBoxId,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        // ── Resumen de flujo de una sesión ───────────────────────────────────────
        group.MapGet("/sessions/{cashBoxSessionId:int}/summary", async (
            int cashBoxSessionId,
            ICurrentUserService currentUser,
            GetCashSessionSummaryQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCashSessionSummaryQuery(currentUser.TenantId, cashBoxSessionId), ct);
            return result.ToOk();
        });

        // ── Apertura de caja ─────────────────────────────────────────────────────
        group.MapPost("/sessions/open", async (
            OpenCashSessionCommand command,
            IValidator<OpenCashSessionCommand> validator,
            ICurrentUserService currentUser,
            OpenCashSessionCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                UserId = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.CashChangedAsync(currentUser.TenantId, "SessionOpened", new { sessionId = result.Value });

            return result.ToCreated(id => $"api/finance/sessions/{id}/summary");
        });

        // ── Cierre de caja ───────────────────────────────────────────────────────
        group.MapPost("/sessions/{cashBoxSessionId:int}/close", async (
            int cashBoxSessionId,
            CloseCashSessionCommand command,
            IValidator<CloseCashSessionCommand> validator,
            ICurrentUserService currentUser,
            CloseCashSessionCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { CashBoxSessionId = cashBoxSessionId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.CashChangedAsync(currentUser.TenantId, "SessionClosed", new { sessionId = cashBoxSessionId });

            return result.ToNoContent();
        });

        // ── Ajustes de caja (Entrada / Gasto) ────────────────────────────────────
        group.MapPost("/sessions/{cashBoxSessionId:int}/adjustments", async (
            int cashBoxSessionId,
            AddCashAdjustmentCommand command,
            IValidator<AddCashAdjustmentCommand> validator,
            ICurrentUserService currentUser,
            AddCashAdjustmentCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                CashBoxSessionId = cashBoxSessionId,
                TenantId = currentUser.TenantId,
                RecordedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.CashChangedAsync(currentUser.TenantId, "AdjustmentAdded", new { sessionId = cashBoxSessionId, type = request.AdjustmentType });

            return result.ToCreated(id => $"api/finance/sessions/{cashBoxSessionId}/summary");
        });

        // ── Conteo físico de billetes/monedas (Arqueos) ─────────────────────────
        group.MapPost("/sessions/{cashBoxSessionId:int}/counts", async (
            int cashBoxSessionId,
            SaveCashBoxCountCommand command,
            IValidator<SaveCashBoxCountCommand> validator,
            ICurrentUserService currentUser,
            SaveCashBoxCountCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with
            {
                CashBoxSessionId = cashBoxSessionId,
                TenantId = currentUser.TenantId,
                RecordedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });
    }
}
