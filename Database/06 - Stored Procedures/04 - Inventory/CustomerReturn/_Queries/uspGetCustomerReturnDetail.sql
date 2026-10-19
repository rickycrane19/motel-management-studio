/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetCustomerReturnDetail]
   SUBDOMAIN:   CustomerReturn
   DESCRIPTION: Devuelve el encabezado de una devolución de cliente y sus
                líneas, en dos result sets.
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetCustomerReturnDetail] (
    @TenantId         UNIQUEIDENTIFIER,
    @CustomerReturnId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        r.CustomerReturnId,
        r.CustomerName,
        r.RoomStayId,
        r.TotalRefund,
        r.CurrencyCode,
        r.CashBoxSessionId,
        r.Notes,
        r.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](r.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[CustomerReturn] AS r
    WHERE r.CustomerReturnId = @CustomerReturnId AND r.TenantId = @TenantId;

    SELECT
        i.CustomerReturnItemId,
        i.ProductId,
        pr.Name AS ProductName,
        pr.Code AS ProductCode,
        pr.UnitOfMeasure,
        i.Quantity,
        i.UnitPrice,
        i.LineTotal,
        i.Notes
    FROM [Inventory].[CustomerReturnItem] AS i
    INNER JOIN [Inventory].[Product] AS pr ON i.ProductId = pr.ProductId
    WHERE i.CustomerReturnId = @CustomerReturnId
    ORDER BY i.CustomerReturnItemId;
END
GO
