/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetCashSessionSummary]
   SUBDOMAIN:   CashBoxSession
   DESCRIPTION: Devuelve el reporte completo de una sesión de caja: resumen con resultado de
                arqueo (cuadrada, sobrante, faltante), detalle de denominaciones y ajustes.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetCashSessionSummary] (
    @TenantId         UNIQUEIDENTIFIER,
    @CashBoxSessionId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1: Encabezado de la sesión y balance
    SELECT
        s.CashBoxSessionId,
        s.CashBoxId,
        cb.Name AS CashBoxName,
        s.UserId,
        u.FullName AS UserName,
        s.ShiftName,
        s.OpenedAtUtc,
        s.ClosedAtUtc,
        [Configuration].[fnToManaguaTime](s.OpenedAtUtc) AS OpenedAtManagua,
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
        END AS ArqueoResult,
        s.Notes
    FROM [Finance].[CashBoxSession] AS s
    INNER JOIN [Finance].[CashBox] AS cb ON s.CashBoxId = cb.CashBoxId
    INNER JOIN [Security].[User] AS u ON s.UserId = u.UserId
    WHERE s.CashBoxSessionId = @CashBoxSessionId AND s.TenantId = @TenantId;

    -- Result set 2: Detalle de denominaciones contadas en el arqueo
    SELECT
        c.CashBoxCountId,
        c.CountTypeId,
        CASE c.CountTypeId WHEN 1 THEN N'Apertura' WHEN 2 THEN N'Pre-Arqueo' WHEN 3 THEN N'Cierre' ELSE N'Otro' END AS CountTypeName,
        d.CurrencyCode,
        d.[Value] AS DenominationValue,
        d.Label,
        c.[Count],
        c.SubTotal,
        c.SubTotalInBase,
        c.RecordedAt,
        [Configuration].[fnToManaguaTime](c.RecordedAt) AS RecordedAtManagua
    FROM [Finance].[CashBoxCount] AS c
    INNER JOIN [Finance].[CashBoxDenomination] AS d ON c.DenominationId = d.DenominationId
    WHERE c.CashBoxSessionId = @CashBoxSessionId AND c.TenantId = @TenantId
    ORDER BY c.CountTypeId, d.CurrencyCode, d.[Value] DESC;

    -- Result set 3: Ajustes de efectivo registrados en el turno
    SELECT
        a.AdjustmentId,
        a.AdjustmentType,
        CASE a.AdjustmentType WHEN 'IN' THEN N'Entrada de Efectivo' ELSE N'Salida / Gasto' END AS AdjustmentTypeName,
        a.CurrencyCode,
        a.Amount,
        a.ExchangeRate,
        a.AmountInBase,
        a.Reason,
        a.RecordedAt,
        [Configuration].[fnToManaguaTime](a.RecordedAt) AS RecordedAtManagua
    FROM [Finance].[CashBoxAdjustment] AS a
    WHERE a.CashBoxSessionId = @CashBoxSessionId AND a.TenantId = @TenantId
    ORDER BY a.RecordedAt;
END
GO
