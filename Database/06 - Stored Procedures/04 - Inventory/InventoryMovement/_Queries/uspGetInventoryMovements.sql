/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspGetInventoryMovements]
   SUBDOMAIN:   InventoryMovement
   DESCRIPTION: Consulta paginada del historial de Kardex con cálculo de hora local Managua.
                Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el total de
                coincidencias para paginar en la UI (RT-05: el servidor pagina).

                Filtros:
                  @ProductId    -> restringe a un producto
                  @MovementType -> restringe a un tipo (Compra, Venta, AjusteEntrada, …)
                  @FromUtc      -> inicio del rango [desde, hasta) sobre CreatedOn (UTC)
                  @ToUtc        -> fin exclusivo del rango
                  @Search       -> producto, código, motivo o documento de referencia

                Orden determinista: CreatedOn DESC, MovementId DESC.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspGetInventoryMovements] (
    @TenantId     UNIQUEIDENTIFIER,
    @ProductId    INT            = NULL,
    @MovementType NVARCHAR(30)   = NULL,
    @FromUtc      DATETIME2      = NULL,
    @ToUtc        DATETIME2      = NULL,
    @Search       NVARCHAR(150)  = NULL,
    @Page         INT            = 1,
    @PageSize     INT            = 20,
    @TotalRecords INT            = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Page = CASE WHEN @Page IS NULL OR @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize IS NULL OR @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');
    SET @MovementType = NULLIF(LTRIM(RTRIM(@MovementType)), '');

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Inventory].[InventoryMovement] AS m
        INNER JOIN [Inventory].[Product] AS p ON m.ProductId = p.ProductId
        WHERE m.TenantId = @TenantId
          AND (@ProductId IS NULL OR m.ProductId = @ProductId)
          AND (@MovementType IS NULL OR m.MovementType = @MovementType)
          AND (@FromUtc IS NULL OR m.CreatedOn >= @FromUtc)
          AND (@ToUtc IS NULL OR m.CreatedOn < @ToUtc)
          AND (@Search IS NULL
               OR p.Name LIKE '%' + @Search + '%'
               OR p.Code LIKE '%' + @Search + '%'
               OR m.Reason LIKE '%' + @Search + '%'
               OR m.ReferenceDoc LIKE '%' + @Search + '%')
    );

    SELECT
        m.MovementId,
        m.ProductId,
        p.Name AS ProductName,
        p.Code AS ProductCode,
        m.MovementType,
        m.Quantity,
        m.PreviousStock,
        m.NewStock,
        m.UnitCost,
        m.TotalCost,
        m.Reason,
        m.ReferenceDoc,
        m.RoomStayId,
        m.CreatedOn AS CreatedOnUtc,
        [Configuration].[fnToManaguaTime](m.CreatedOn) AS CreatedOnManagua
    FROM [Inventory].[InventoryMovement] AS m
    INNER JOIN [Inventory].[Product] AS p ON m.ProductId = p.ProductId
    WHERE m.TenantId = @TenantId
      AND (@ProductId IS NULL OR m.ProductId = @ProductId)
      AND (@MovementType IS NULL OR m.MovementType = @MovementType)
      AND (@FromUtc IS NULL OR m.CreatedOn >= @FromUtc)
      AND (@ToUtc IS NULL OR m.CreatedOn < @ToUtc)
      AND (@Search IS NULL
           OR p.Name LIKE '%' + @Search + '%'
           OR p.Code LIKE '%' + @Search + '%'
           OR m.Reason LIKE '%' + @Search + '%'
           OR m.ReferenceDoc LIKE '%' + @Search + '%')
    ORDER BY m.CreatedOn DESC, m.MovementId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
