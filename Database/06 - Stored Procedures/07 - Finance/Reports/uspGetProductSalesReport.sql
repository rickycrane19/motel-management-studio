/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetProductSalesReport]
   SUBDOMAIN:   Reports
   DESCRIPTION: Ventas de productos (minibar) por producto: la venta se contabiliza en las
                consumiciones de estancias cerradas/cobradas en el período (RoomStayConsumption,
                la misma fuente que congeló RoomStay.ProductsTotal y que se cobró en el check-out;
                ver uspAddStayConsumption). Margen con el CostPrice vigente del producto.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetProductSalesReport] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2,
    @ToUtc    DATETIME2
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        p.ProductId,
        p.Code AS ProductCode,
        p.Name AS ProductName,
        cat.Name AS CategoryName,
        p.UnitOfMeasure,
        SUM(c.Quantity) AS SoldQuantity,
        SUM(c.SubTotal) AS Revenue,
        SUM(c.Quantity * ISNULL(p.CostPrice, 0)) AS Cost,
        SUM(c.SubTotal) - SUM(c.Quantity * ISNULL(p.CostPrice, 0)) AS Margin,
        COUNT(DISTINCT c.RoomStayId) AS StaysWithSale
    FROM [Service].[RoomStayConsumption] AS c
    INNER JOIN [Service].[RoomStay] AS rs ON rs.RoomStayId = c.RoomStayId
    INNER JOIN [Inventory].[Product] AS p ON p.ProductId = c.ProductId
    LEFT JOIN [Inventory].[Category] AS cat ON cat.CategoryId = p.CategoryId
    WHERE rs.TenantId = @TenantId
      AND rs.[Status] = 2
      AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
      AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc
    GROUP BY p.ProductId, p.Code, p.Name, cat.Name, p.UnitOfMeasure
    ORDER BY Revenue DESC, p.Name;
END
GO
