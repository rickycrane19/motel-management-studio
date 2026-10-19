/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetProductStats]
   SUBDOMAIN:   Product
   DESCRIPTION: Resumen ligero del catálogo de productos para las tarjetas de estadísticas del
                listado, sin traer todas las filas al cliente. Devuelve una sola fila:
                  Total    -> productos del tenant
                  Active   -> productos visibles en el catálogo
                  Inactive -> productos ocultos
                  LowStock -> productos activos con existencias <= stock mínimo
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetProductStats] (
    @TenantId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*)                                                          AS Total,
        ISNULL(SUM(CASE WHEN p.IsActive = 1 THEN 1 ELSE 0 END), 0)        AS Active,
        ISNULL(SUM(CASE WHEN p.IsActive = 0 THEN 1 ELSE 0 END), 0)        AS Inactive,
        ISNULL(SUM(CASE WHEN p.IsActive = 1
                          AND p.CurrentStock <= p.MinStock THEN 1 ELSE 0 END), 0) AS LowStock
    FROM [Inventory].[Product] AS p
    WHERE p.TenantId = @TenantId;
END
GO
