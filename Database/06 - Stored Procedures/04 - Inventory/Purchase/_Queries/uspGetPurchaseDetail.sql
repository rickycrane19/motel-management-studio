/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetPurchaseDetail]
   SUBDOMAIN:   Purchase
   DESCRIPTION: Devuelve el encabezado del documento (compra o devolución a
                proveedor) y sus líneas, en dos result sets.
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetPurchaseDetail] (
    @TenantId   UNIQUEIDENTIFIER,
    @PurchaseId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.PurchaseId,
        p.PurchaseType,
        p.SupplierId,
        COALESCE(s.Name, p.SupplierName) AS SupplierName,
        p.ReferenceDoc,
        p.TotalAmount,
        p.CurrencyCode,
        p.CashBoxSessionId,
        p.Notes,
        p.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](p.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[Purchase] AS p
    LEFT JOIN [Inventory].[Supplier] AS s ON s.SupplierId = p.SupplierId
    WHERE p.PurchaseId = @PurchaseId AND p.TenantId = @TenantId;

    SELECT
        i.PurchaseItemId,
        i.ProductId,
        pr.Name AS ProductName,
        pr.Code AS ProductCode,
        pr.UnitOfMeasure,
        i.Quantity,
        i.UnitCost,
        i.LineTotal,
        i.Notes
    FROM [Inventory].[PurchaseItem] AS i
    INNER JOIN [Inventory].[Product] AS pr ON i.ProductId = pr.ProductId
    WHERE i.PurchaseId = @PurchaseId
    ORDER BY i.PurchaseItemId;
END
GO
