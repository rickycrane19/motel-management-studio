/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspAddStayConsumption]
   SUBDOMAIN:   RoomStay
   DESCRIPTION: Agrega un producto de minibar/consumo a una habitación en estancia activa,
                descontando automáticamente el inventario e insertando el registro en Kardex.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Estancia o producto no existe)
    50422 -> Conflict/Negocio          (Estancia no activa, stock insuficiente)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspAddStayConsumption] (
    @TenantId     UNIQUEIDENTIFIER,
    @RoomStayId   INT,
    @ProductId    INT,
    @Quantity     DECIMAL(12,2),
    @CreatedBy    INT = NULL,
    @Notes        NVARCHAR(200) = NULL,
    @InsertedId   INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomStayId IS NULL OR @RoomStayId <= 0
        THROW 50400, N'El ID de la estancia no es válido.', 1;

    IF @ProductId IS NULL OR @ProductId <= 0
        THROW 50400, N'El ID del producto no es válido.', 1;

    IF @Quantity IS NULL OR @Quantity <= 0
        THROW 50400, N'La cantidad debe ser mayor a cero.', 1;

    DECLARE @StayStatus TINYINT;
    DECLARE @LocationId UNIQUEIDENTIFIER;
    DECLARE @RoomId INT;

    SELECT @StayStatus = [Status], @LocationId = LocationId, @RoomId = RoomId
    FROM [Service].[RoomStay]
    WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

    IF @StayStatus IS NULL
        THROW 50404, N'La estancia no existe.', 1;

    IF @StayStatus <> 1
        THROW 50422, N'No se pueden agregar productos a una habitación cuya estancia ya finalizó o fue cancelada.', 1;

    DECLARE @SalePrice DECIMAL(18,4);
    DECLARE @CostPrice DECIMAL(18,4);
    DECLARE @CurrentStock DECIMAL(12,2);

    SELECT 
        @SalePrice = SalePrice,
        @CostPrice = CostPrice,
        @CurrentStock = CurrentStock
    FROM [Inventory].[Product]
    WHERE ProductId = @ProductId AND TenantId = @TenantId AND IsActive = 1;

    IF @SalePrice IS NULL
        THROW 50404, N'El producto no existe o no está activo.', 1;

    IF @CurrentStock < @Quantity
        THROW 50422, N'Stock insuficiente para el producto seleccionado en minibar.', 1;

    DECLARE @SubTotal DECIMAL(18,4) = @Quantity * @SalePrice;
    DECLARE @NewStock DECIMAL(12,2) = @CurrentStock - @Quantity;
    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[RoomStayConsumption]
        (
            TenantId,
            RoomStayId,
            ProductId,
            Quantity,
            UnitPrice,
            SubTotal,
            Notes,
            CreatedBy,
            CreatedOnUtc
        )
        VALUES
        (
            @TenantId,
            @RoomStayId,
            @ProductId,
            @Quantity,
            @SalePrice,
            @SubTotal,
            @Notes,
            @CreatedBy,
            @NowUtc
        );

        SET @InsertedId = SCOPE_IDENTITY();

        UPDATE [Inventory].[Product]
        SET CurrentStock = @NewStock
        WHERE ProductId = @ProductId AND TenantId = @TenantId;

        INSERT INTO [Inventory].[InventoryMovement]
        (
            TenantId,
            LocationId,
            ProductId,
            MovementType,
            Quantity,
            PreviousStock,
            NewStock,
            UnitCost,
            TotalCost,
            Reason,
            ReferenceDoc,
            RoomStayId,
            CreatedOn,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @ProductId,
            N'Venta',
            @Quantity,
            @CurrentStock,
            @NewStock,
            @CostPrice,
            @CostPrice * @Quantity,
            CONCAT(N'Consumo en habitación (Estancia #', @RoomStayId, N')'),
            CONCAT(N'STAY-', @RoomStayId),
            @RoomStayId,
            @NowUtc,
            @CreatedBy
        );

        UPDATE [Service].[RoomStay]
        SET ProductsTotal = ProductsTotal + @SubTotal,
            TotalAmount = TotalAmount + @SubTotal
        WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

        IF @IsTranStarted = 1
            COMMIT TRAN;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() = -1
            ROLLBACK TRAN;
        ELSE IF XACT_STATE() = 1 AND @IsTranStarted = 1
            ROLLBACK TRAN;

        ;THROW;
    END CATCH
END
GO
