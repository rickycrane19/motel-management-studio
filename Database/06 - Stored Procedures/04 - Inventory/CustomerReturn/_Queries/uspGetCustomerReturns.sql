/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetCustomerReturns]
   SUBDOMAIN:   CustomerReturn
   DESCRIPTION: Listado PAGINADO de devoluciones de clientes con hora local de
                Managua. @Search busca por cliente, notas o número de documento;
                @TotalRecords (OUTPUT) trae el total de coincidencias y
                @Documents / @RefundedAmount los contadores del rango.
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetCustomerReturns] (
    @TenantId       UNIQUEIDENTIFIER,
    @Search         NVARCHAR(150)  = NULL,
    @FromUtc        DATETIME2      = NULL,
    @ToUtc          DATETIME2      = NULL,
    @Page           INT            = 1,
    @PageSize       INT            = 20,
    @TotalRecords   INT            = NULL OUTPUT,
    @Documents      INT            = NULL OUTPUT,
    @RefundedAmount DECIMAL(18,2)  = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    -- Contadores del rango para las tarjetas de resumen.
    SELECT
        @Documents      = COUNT(*),
        @RefundedAmount = ISNULL(SUM(r.TotalRefund), 0)
    FROM [Inventory].[CustomerReturn] AS r
    WHERE r.TenantId = @TenantId
      AND (@FromUtc IS NULL OR r.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR r.CreatedOn < @ToUtc);

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Inventory].[CustomerReturn] AS r
        WHERE r.TenantId = @TenantId
          AND (@FromUtc IS NULL OR r.CreatedOn >= @FromUtc)
          AND (@ToUtc IS NULL OR r.CreatedOn < @ToUtc)
          AND (@Search IS NULL
               OR r.CustomerName LIKE '%' + @Search + '%'
               OR r.Notes LIKE '%' + @Search + '%'
               OR CAST(r.CustomerReturnId AS NVARCHAR(20)) LIKE '%' + @Search + '%')
    );

    SELECT
        r.CustomerReturnId,
        r.CustomerName,
        r.RoomStayId,
        r.TotalRefund,
        r.CurrencyCode,
        r.CashBoxSessionId,
        r.Notes,
        (SELECT COUNT(*) FROM [Inventory].[CustomerReturnItem] AS i WHERE i.CustomerReturnId = r.CustomerReturnId) AS LineCount,
        r.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](r.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[CustomerReturn] AS r
    WHERE r.TenantId = @TenantId
      AND (@FromUtc IS NULL OR r.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR r.CreatedOn < @ToUtc)
      AND (@Search IS NULL
           OR r.CustomerName LIKE '%' + @Search + '%'
           OR r.Notes LIKE '%' + @Search + '%'
           OR CAST(r.CustomerReturnId AS NVARCHAR(20)) LIKE '%' + @Search + '%')
    ORDER BY r.CreatedOn DESC, r.CustomerReturnId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
