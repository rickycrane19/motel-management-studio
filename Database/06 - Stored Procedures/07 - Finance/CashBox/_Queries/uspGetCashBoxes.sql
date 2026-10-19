/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetCashBoxes]
   SUBDOMAIN:   CashBox
   DESCRIPTION: Lista las cajas físicas / terminales de cobro registradas en el motel.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetCashBoxes] (
    @TenantId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        CashBoxId,
        TenantId,
        LocationId,
        Name,
        Code,
        IsActive
    FROM [Finance].[CashBox]
    WHERE TenantId = @TenantId
      AND IsActive = 1
    ORDER BY Name;
END
GO
