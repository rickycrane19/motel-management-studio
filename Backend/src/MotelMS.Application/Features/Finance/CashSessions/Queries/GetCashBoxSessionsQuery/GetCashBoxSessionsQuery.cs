using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Features.Finance.Reports;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Finance.CashSessions.Queries.GetCashBoxSessionsQuery;

/// <summary>
/// Historial de un turno/sesión de caja con su reconciliación (saldo inicial, ventas, ajustes,
/// calculado vs contado y resultado del arqueo). Los montos vienen en moneda base.
/// </summary>
public sealed record CashBoxSessionListItemDto
{
    public int CashBoxSessionId { get; init; }
    public string CashBoxName { get; init; } = string.Empty;
    public string ShiftName { get; init; } = string.Empty;
    public string UserName { get; init; } = string.Empty;
    public DateTime OpenedAtUtc { get; init; }
    public DateTime? OpenedAtManagua { get; init; }
    public DateTime? ClosedAtUtc { get; init; }
    public DateTime? ClosedAtManagua { get; init; }
    public byte StatusCode { get; init; }
    public string StatusName { get; init; } = string.Empty;
    public decimal OpeningBalanceBase { get; init; }
    public decimal TotalSalesBase { get; init; }
    public decimal TotalInAdjustmentsBase { get; init; }
    public decimal TotalOutAdjustmentsBase { get; init; }
    public decimal ClosingCalculatedBase { get; init; }
    public decimal ClosingActualBase { get; init; }
    public decimal DifferenceBase { get; init; }
    /// <summary>Resultado del arqueo: 'Cuadrada' | 'Sobrante' | 'Faltante'.</summary>
    public string DifferenceKind { get; init; } = string.Empty;
    public string? Notes { get; init; }
    /// <summary>Número de ajustes de salida/gasto (OUT) registrados en el turno.</summary>
    public int OutAdjustmentsCount { get; init; }
    /// <summary>Número de líneas de conteo físico (denominaciones) registradas en el turno.</summary>
    public int CountsCount { get; init; }
}

/// <summary>
/// Página del historial de turnos: solo la ventana pedida + el total para paginar y el rango
/// UTC realmente aplicado (por si el request no trajo fechas y se usó el default de Managua).
/// </summary>
public sealed record CashBoxSessionsPageDto(
    DateTime FromUtc,
    DateTime ToUtc,
    IReadOnlyList<CashBoxSessionListItemDto> Items,
    int TotalRecords,
    int Page,
    int PageSize);

public sealed record GetCashBoxSessionsQuery(
    Guid TenantId,
    DateTime? FromUtc = null,
    DateTime? ToUtc = null,
    int? CashBoxId = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetCashBoxSessionsQueryHandler(ISqlConnector connector)
{
    /// <summary>Días del negocio (America/Managua) que abarca el default cuando no llegan fechas.</summary>
    private const int DefaultWindowDays = 30;

    public async Task<Result<CashBoxSessionsPageDto>> HandleAsync(GetCashBoxSessionsQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize switch
        {
            < 1 => 20,
            > 200 => 200,
            _ => query.PageSize
        };

        var fromUtc = query.FromUtc ?? DefaultFromUtc();
        var toUtc = query.ToUtc ?? DefaultToUtc();
        if (toUtc <= fromUtc)
        {
            fromUtc = DefaultFromUtc();
            toUtc = DefaultToUtc();
        }

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", query.TenantId);
        parameters.Add("@FromUtc", fromUtc);
        parameters.Add("@ToUtc", toUtc);
        parameters.Add("@CashBoxId", query.CashBoxId);
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<CashBoxSessionListItemDto>(
            connector,
            "[Finance].[uspGetCashBoxSessions]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<CashBoxSessionsPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        return Result<CashBoxSessionsPageDto>.Success(
            new CashBoxSessionsPageDto(fromUtc, toUtc, result.Value.ToList(), total, page, pageSize));
    }

    /// <summary>Inicio del día (Managua) de hace <see cref="DefaultWindowDays"/> días, en UTC.</summary>
    private static DateTime DefaultFromUtc()
        => ReportDateRange.ToUtc(LocalToday().AddDays(-(DefaultWindowDays - 1)).ToDateTime(TimeOnly.MinValue));

    /// <summary>Inicio del día siguiente a hoy (Managua), en UTC: límite exclusivo del rango.</summary>
    private static DateTime DefaultToUtc()
        => ReportDateRange.ToUtc(LocalToday().AddDays(1).ToDateTime(TimeOnly.MinValue));

    private static DateOnly LocalToday() => DateOnly.FromDateTime(ReportDateRange.LocalNow());
}
