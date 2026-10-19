/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetInventoryReport]
   SUBDOMAIN:   Reports
   DESCRIPTION: Estado del inventario (instantánea) + actividad del kardex del período
                [FromUtc, ToUtc): valor de stock por producto y por categoría, productos bajo
                mínimo, y compras/devoluciones/ventas del kardex (MovementType) por producto.
                NOTA: los totales de compra/devolución a proveedor se leen del kardex
                (InventoryMovement 'Compra' / 'DevolucionProveedor'), que es la fuente en la que
                también registra el módulo de compras; los documentos de detalle de compra
                (Inventory.Purchase / PurchaseItem) se consultan en su módulo, no aquí.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetInventoryReport] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2      = NULL,
    @ToUtc    DATETIME2      = NULL
)
AS
BEGIN
    SET NOCOUNT ON;

    WITH Kardex AS
    (
        SELECT
            m.ProductId,
            SUM(CASE WHEN m.MovementType = N'Compra' THEN m.TotalCost ELSE 0 END) AS PurchaseCost,
            SUM(CASE WHEN m.MovementType = N'Compra' THEN m.Quantity ELSE 0 END) AS PurchaseQuantity,
            SUM(CASE WHEN m.MovementType = N'DevolucionProveedor' THEN m.TotalCost ELSE 0 END) AS SupplierReturnCost,
            SUM(CASE WHEN m.MovementType = N'DevolucionProveedor' THEN m.Quantity ELSE 0 END) AS SupplierReturnQuantity,
            SUM(CASE WHEN m.MovementType = N'DevolucionCliente' THEN m.TotalCost ELSE 0 END) AS CustomerReturnCost,
            SUM(CASE WHEN m.MovementType = N'Venta' THEN m.TotalCost ELSE 0 END) AS SoldCost,
            SUM(CASE WHEN m.MovementType = N'Venta' THEN m.Quantity ELSE 0 END) AS SoldQuantity,
            SUM(CASE WHEN m.MovementType IN (N'AjusteEntrada', N'AjusteSalida') THEN m.TotalCost ELSE 0 END) AS AdjustmentCost
        FROM [Inventory].[InventoryMovement] AS m
        WHERE m.TenantId = @TenantId
          AND (@FromUtc IS NULL OR m.CreatedOn >= @FromUtc)
          AND (@ToUtc IS NULL OR m.CreatedOn < @ToUtc)
        GROUP BY m.ProductId
    )
    SELECT
        p.ProductId,
        p.Code AS ProductCode,
        p.Name AS ProductName,
        cat.Name AS CategoryName,
        p.UnitOfMeasure,
        p.CurrentStock,
        p.MinStock,
        CASE WHEN p.CurrentStock <= p.MinStock THEN 1 ELSE 0 END AS IsUnderMinStock,
        ISNULL(p.CostPrice, 0) AS CostPrice,
        ISNULL(p.SalePrice, 0) AS SalePrice,
        ISNULL(p.CurrentStock, 0) * ISNULL(p.CostPrice, 0) AS StockValue,
        ISNULL(k.PurchaseQuantity, 0) AS PurchaseQuantity,
        ISNULL(k.PurchaseCost, 0) AS PurchaseCost,
        ISNULL(k.SupplierReturnQuantity, 0) AS SupplierReturnQuantity,
        ISNULL(k.SupplierReturnCost, 0) AS SupplierReturnCost,
        ISNULL(k.CustomerReturnCost, 0) AS CustomerReturnCost,
        ISNULL(k.SoldQuantity, 0) AS SoldQuantity,
        ISNULL(k.SoldCost, 0) AS SoldCost,
        ISNULL(k.AdjustmentCost, 0) AS AdjustmentCost
    FROM [Inventory].[Product] AS p
    INNER JOIN [Inventory].[Category] AS cat ON cat.CategoryId = p.CategoryId
    LEFT JOIN Kardex AS k ON k.ProductId = p.ProductId
    WHERE p.TenantId = @TenantId
      AND p.IsActive = 1
    ORDER BY cat.Name, p.Name;
END
GO
