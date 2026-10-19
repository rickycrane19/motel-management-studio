using Carter;
using FluentValidation;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Finance.FinancialLoss.Commands.RecordFinancialLossCommand;
using MotelMS.Application.Features.Finance.FinancialLoss.Queries.GetFinancialLossesQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Finance;

/// <summary>
/// Pérdidas registrables del negocio (Finance.FinancialLoss). Son registros inmutables de
/// propósito contable: solo se listan y se registran (no hay edición ni borrado).
/// </summary>
public sealed class LossEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/finance/losses").WithTags("Finance · Losses").RequireAuthorization();

        // ── Listado paginado de pérdidas registradas (DESC por fecha) ────────────────
        group.MapGet("/", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            string? category,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetFinancialLossesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetFinancialLossesQuery(
                currentUser.TenantId,
                from?.UtcDateTime,
                to?.UtcDateTime,
                FromCategoryFilter(category),
                page ?? 1,
                pageSize ?? 50), ct);
            return result.ToOk();
        });

        // ── Registro de una pérdida (inmutable) ──────────────────────────────────────
        group.MapPost("/", async (
            RecordLossRequest request,
            IValidator<RecordFinancialLossCommand> validator,
            ICurrentUserService currentUser,
            RecordFinancialLossCommandHandler handler,
            CancellationToken ct) =>
        {
            var command = new RecordFinancialLossCommand(
                currentUser.TenantId,
                currentUser.LocationId,
                request.categoryCode,
                request.description ?? string.Empty,
                request.amount,
                string.IsNullOrWhiteSpace(request.currencyCode) ? "NIO" : request.currencyCode.Trim().ToUpperInvariant(),
                request.roomId,
                request.roomStayId,
                request.cashBoxSessionId,
                currentUser.UserId);

            var invalid = await validator.ValidateEntityAsync(command, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(command, ct);
            return result.ToCreated(id => $"api/finance/losses/{id}");
        });
    }

    private static string? FromCategoryFilter(string? category) =>
        string.IsNullOrWhiteSpace(category) ? null : category.Trim();
}

public sealed record RecordLossRequest(
    string categoryCode,
    string? description,
    decimal amount,
    string? currencyCode,
    int? roomId,
    int? roomStayId,
    int? cashBoxSessionId);
