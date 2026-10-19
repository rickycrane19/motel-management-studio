/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspRecordInventoryMovement]
   SUBDOMAIN:   InventoryMovement
   DESCRIPTION: Registra un movimiento de Kardex (Compra, AjusteEntrada, AjusteSalida por merma/daño,
                DevolucionProveedor, DevolucionCliente) y actualiza el stock físico del producto.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Producto no existe)
    50422 -> Conflict/Negocio          (Stock insuficiente para la salida)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspRecordInventoryMovement] (
    @TenantId     UNIQUEIDENTIFIER,
    @LocationId   UNIQUEIDENTIFIER = NULL,
    @ProductId    INT,
    @MovementType NVARCHAR(30), -- 'Compra', 'Venta', 'AjusteEntrada', 'AjusteSalida', 'DevolucionProveedor', 'DevolucionCliente'
    @Quantity     DECIMAL(12,2),
    @UnitCost     DECIMAL(18,4) = NULL,
    @Reason       NVARCHAR(250) = NULL,
    @ReferenceDoc NVARCHAR(100) = NULL,
    @CreatedBy    INT = NULL,
    @InsertedId   INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @ProductId IS NULL OR @ProductId <= 0
        THROW 50400, N'El ID del producto no es válido.', 1;

    IF @Quantity IS NULL OR @Quantity <= 0
        THROW 50400, N'La cantidad del movimiento debe ser mayor a cero.', 1;

    IF @MovementType NOT IN ('Compra', 'Venta', 'AjusteEntrada', 'AjusteSalida', 'DevolucionProveedor', 'DevolucionCliente')
        THROW 50400, N'El tipo de movimiento de inventario no es válido.', 1;

    DECLARE @CurrentStock DECIMAL(12,2);
    DECLARE @ProductCost DECIMAL(18,4);

    SELECT @CurrentStock = CurrentStock, @ProductCost = CostPrice
    FROM [Inventory].[Product]
    WHERE ProductId = @ProductId AND TenantId = @TenantId AND IsActive = 1;

    IF @CurrentStock IS NULL
        THROW 50404, N'El producto no existe o está inactivo.', 1;

    SET @UnitCost = ISNULL(@UnitCost, @ProductCost);

    DECLARE @NewStock DECIMAL(12,2);

    IF @MovementType IN ('Compra', 'AjusteEntrada', 'DevolucionCliente')
    BEGIN
        SET @NewStock = @CurrentStock + @Quantity;
    END
    ELSE
    BEGIN
        IF @CurrentStock < @Quantity
            THROW 50422, N'Stock insuficiente para realizar la salida de inventario.', 1;

        SET @NewStock = @CurrentStock - @Quantity;
    END

    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Inventory].[Product]
        SET CurrentStock = @NewStock,
            CostPrice = CASE WHEN @MovementType = 'Compra' AND @UnitCost > 0 THEN @UnitCost ELSE CostPrice END
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
            CreatedOn,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @ProductId,
            @MovementType,
            @Quantity,
            @CurrentStock,
            @NewStock,
            @UnitCost,
            @UnitCost * @Quantity,
            @Reason,
            @ReferenceDoc,
            @NowUtc,
            @CreatedBy
        );

        SET @InsertedId = SCOPE_IDENTITY();

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
