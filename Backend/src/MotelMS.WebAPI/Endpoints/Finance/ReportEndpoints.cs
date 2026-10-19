using Carter;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Finance.Reports;
using MotelMS.Application.Features.Finance.Reports.GetCashierPerformanceReportQuery;
using MotelMS.Application.Features.Finance.Reports.GetFinancialSummaryQuery;
using MotelMS.Application.Features.Finance.Reports.GetInventoryReportQuery;
using MotelMS.Application.Features.Finance.Reports.GetPayrollExpenseReportQuery;
using MotelMS.Application.Features.Finance.Reports.GetProductSalesReportQuery;
using MotelMS.Application.Features.Finance.Reports.GetServiceSalesReportQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Finance;

/// <summary>
/// Reportes consolidados de Finance. Todos aceptan from/to; si no se envían, el rango por
/// defecto es el MES ACTUAL en Managua (America/Managua) y la respuesta siempre devuelve
/// el rango realmente aplicado (from/to UTC) para que el UI lo muestre.
/// </summary>
public sealed class ReportEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/finance/reports").WithTags("Finance · Reports").RequireAuthorization();

        // ── Resumen financiero consolidado (ingresos/egresos por fuente) ─────────────
        group.MapGet("/summary", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            ICurrentUserService currentUser,
            GetFinancialSummaryQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetFinancialSummaryQuery(currentUser.TenantId, range.FromUtc, range.ToUtc), ct);
            return result.ToOk();
        });

        // ── Ventas de servicios (estancias cerradas) por tarifa y tipo de llegada ────
        group.MapGet("/sales/service", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            ICurrentUserService currentUser,
            GetServiceSalesReportQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetServiceSalesReportQuery(currentUser.TenantId, range.FromUtc, range.ToUtc), ct);
            return result.ToOk();
        });

        // ── Ventas de productos (minibar) con costo y margen ────────────────────────
        group.MapGet("/sales/products", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            ICurrentUserService currentUser,
            GetProductSalesReportQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetProductSalesReportQuery(currentUser.TenantId, range.FromUtc, range.ToUtc), ct);
            return result.ToOk();
        });

        // ── Inventario: valor de stock, bajo mínimo y movimientos del kardex ────────
        group.MapGet("/inventory", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            ICurrentUserService currentUser,
            GetInventoryReportQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetInventoryReportQuery(currentUser.TenantId, range.FromUtc, range.ToUtc), ct);
            return result.ToOk();
        });

        // ── Gasto de nómina consolidado por empleado ────────────────────────────────
        group.MapGet("/payroll", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            ICurrentUserService currentUser,
            GetPayrollExpenseReportQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetPayrollExpenseReportQuery(currentUser.TenantId, range.FromUtc, range.ToUtc), ct);
            return result.ToOk();
        });

        // ── Rendimiento por cajero: ventas cobradas, propinas y comisiones ──────────
        // `userId` es opcional; sin él devuelve una fila por usuario con sesiones en el rango
        // y una fila TOTAL al final (UserId = 0).
        group.MapGet("/cashiers", async (
            DateTimeOffset? from,
            DateTimeOffset? to,
            int? userId,
            ICurrentUserService currentUser,
            GetCashierPerformanceReportQueryHandler handler,
            CancellationToken ct) =>
        {
            var range = ReportDateRange.Resolve(from, to);
            var result = await handler.HandleAsync(
                new GetCashierPerformanceReportQuery(currentUser.TenantId, range.FromUtc, range.ToUtc, userId), ct);
            return result.ToOk();
        });
    }
}
