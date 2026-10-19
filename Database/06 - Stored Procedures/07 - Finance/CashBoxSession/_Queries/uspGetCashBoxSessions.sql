/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetCashBoxSessions]
   SUBDOMAIN:   CashBoxSession
   DESCRIPTION: Historial paginado (DESC) de turnos/sesiones de caja con su reconciliación:
                saldo inicial, ventas, ajustes, calculado vs contado y resultado del arqueo
                (Cuadrada / Sobrante / Faltante). Filtra por rango de apertura [@FromUtc, @ToUtc)
                y por caja opcional, con hora local Managua y contadores de ajustes OUT y conteos.
                Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el total de
                coincidencias para poder paginar en la UI.
   ═══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetCashBoxSessions] (
    @TenantId     UNIQUEIDENTIFIER,
    @FromUtc      DATETIME2,
    @ToUtc        DATETIME2,
    @CashBoxId    INT = NULL,
    @Page         INT = 1,
    @PageSize     INT = 20,
    @TotalRecords INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    IF @FromUtc IS NULL
        SET @FromUtc = CONVERT(DATETIME2, '1900-01-01');

    IF @ToUtc IS NULL
        SET @ToUtc = CONVERT(DATETIME2, '9999-12-31');

    IF @Page IS NULL OR @Page < 1
        SET @Page = 1;

    IF @PageSize IS NULL OR @PageSize < 1
        SET @PageSize = 20;

    IF @PageSize > 200
        SET @PageSize = 200;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Finance].[CashBoxSession] AS s
        WHERE s.TenantId = @TenantId
          AND s.OpenedAtUtc >= @FromUtc
          AND s.OpenedAtUtc < @ToUtc
          AND (@CashBoxId IS NULL OR s.CashBoxId = @CashBoxId)
    );

    SELECT
        s.CashBoxSessionId,
        cb.Name AS CashBoxName,
        s.ShiftName,
        u.FullName AS UserName,
        s.OpenedAtUtc,
        [Configuration].[fnToManaguaTime](s.OpenedAtUtc) AS OpenedAtManagua,
        s.ClosedAtUtc,
        [Configuration].[fnToManaguaTime](s.ClosedAtUtc) AS ClosedAtManagua,
        s.[Status] AS StatusCode,
        CASE s.[Status] WHEN 1 THEN N'Abierta' WHEN 2 THEN N'Cerrada' ELSE N'N/A' END AS StatusName,
        s.OpeningBalanceBase,
        s.TotalSalesBase,
        s.TotalInAdjustmentsBase,
        s.TotalOutAdjustmentsBase,
        s.ClosingCalculatedBase,
        s.ClosingActualBase,
        s.DifferenceBase,
        CASE
            WHEN s.DifferenceBase > 0 THEN N'Sobrante'
            WHEN s.DifferenceBase < 0 THEN N'Faltante'
            ELSE N'Cuadrada'
        END AS DifferenceKind,
        s.Notes,
        (SELECT COUNT(*)
           FROM [Finance].[CashBoxAdjustment] AS a
          WHERE a.CashBoxSessionId = s.CashBoxSessionId
            AND a.TenantId = s.TenantId
            AND a.AdjustmentType = 'OUT') AS OutAdjustmentsCount,
        (SELECT COUNT(*)
           FROM [Finance].[CashBoxCount] AS c
          WHERE c.CashBoxSessionId = s.CashBoxSessionId
            AND c.TenantId = s.TenantId) AS CountsCount
    FROM [Finance].[CashBoxSession] AS s
    INNER JOIN [Finance].[CashBox] AS cb ON s.CashBoxId = cb.CashBoxId
    INNER JOIN [Security].[User] AS u ON s.UserId = u.UserId
    WHERE s.TenantId = @TenantId
      AND s.OpenedAtUtc >= @FromUtc
      AND s.OpenedAtUtc < @ToUtc
      AND (@CashBoxId IS NULL OR s.CashBoxId = @CashBoxId)
    ORDER BY s.OpenedAtUtc DESC, s.CashBoxSessionId DESC
    OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END
GO
