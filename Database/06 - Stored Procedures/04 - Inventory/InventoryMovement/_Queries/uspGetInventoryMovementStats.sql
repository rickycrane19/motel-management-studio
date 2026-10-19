/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetInventoryMovementStats]
   SUBDOMAIN:   InventoryMovement
   DESCRIPTION: Resumen ligero del Kardex por rango de fechas para las tarjetas del listado,
                sin traer todas las filas al cliente. Devuelve una sola fila:
                  Total   -> movimientos del rango
                  Entries -> movimientos que SUMAN al inventario
                  Exits   -> movimientos que RESTAN del inventario
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetInventoryMovementStats] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2 = NULL,
    @ToUtc    DATETIME2 = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*) AS Total,
        ISNULL(SUM(CASE WHEN m.MovementType IN ('Compra', 'AjusteEntrada', 'DevolucionCliente')
                        THEN 1 ELSE 0 END), 0) AS Entries,
        ISNULL(SUM(CASE WHEN m.MovementType IN ('Venta', 'AjusteSalida', 'DevolucionProveedor')
                        THEN 1 ELSE 0 END), 0) AS Exits
    FROM [Inventory].[InventoryMovement] AS m
    WHERE m.TenantId = @TenantId
      AND (@FromUtc IS NULL OR m.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR m.CreatedOn < @ToUtc);
END
GO
