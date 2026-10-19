/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspCreatePurchase]
   SUBDOMAIN:   Purchase
   DESCRIPTION: Registra un documento de inventario (Compra o DevolucionProveedor)
                con varias líneas. Por cada línea actualiza el stock, graba el
                movimiento de Kardex y, si se indica una sesión de caja abierta,
                registra el ajuste de efectivo (OUT en compra / IN en devolución).

   ────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos / JSON malformado)
    50404 -> Not Found                 (Producto o sesión de caja no existe)
    50422 -> Conflict/Negocio          (Stock insuficiente / sesión cerrada)
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspCreatePurchase] (
    @TenantId         UNIQUEIDENTIFIER,
    @LocationId       UNIQUEIDENTIFIER = NULL,
    @PurchaseType     NVARCHAR(30),   -- 'Compra' | 'DevolucionProveedor'
    @SupplierId       INT           = NULL,  -- proveedor del maestro (opcional; si no, se usa @SupplierName libre)
    @SupplierName     NVARCHAR(150) = NULL,
    @ReferenceDoc     NVARCHAR(100) = NULL,
    @CashBoxSessionId INT           = NULL,
    @Notes            NVARCHAR(500) = NULL,
    @ItemsJson        NVARCHAR(MAX),  -- [{"ProductId":1,"Quantity":2,"UnitCost":10.5}]
    @CreatedBy        INT           = NULL,
    @InsertedId       INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @PurchaseType NOT IN ('Compra', 'DevolucionProveedor')
        THROW 50400, N'El tipo de documento debe ser Compra o DevolucionProveedor.', 1;

    DECLARE @Items TABLE
    (
        RowNumber INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductId INT           NOT NULL,
        Quantity  DECIMAL(12,2) NOT NULL,
        UnitCost  DECIMAL(18,4) NOT NULL
    );

    IF @ItemsJson IS NULL
        THROW 50400, N'El documento necesita al menos una línea de producto.', 1;

    BEGIN TRY
        INSERT INTO @Items (ProductId, Quantity, UnitCost)
        SELECT j.ProductId, j.Quantity, j.UnitCost
        FROM OPENJSON(@ItemsJson)
        WITH (
            ProductId INT           '$.ProductId',
            Quantity  DECIMAL(12,2) '$.Quantity',
            UnitCost  DECIMAL(18,4) '$.UnitCost'
        ) AS j;
    END TRY
    BEGIN CATCH
        THROW 50400, N'El formato de las líneas del documento no es válido.', 1;
    END CATCH

    IF NOT EXISTS (SELECT 1 FROM @Items)
        THROW 50400, N'El documento necesita al menos una línea de producto.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE ProductId IS NULL OR ProductId <= 0)
        THROW 50400, N'Hay líneas con un ID de producto no válido.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE Quantity IS NULL OR Quantity <= 0)
        THROW 50400, N'Hay líneas con cantidad menor o igual a cero.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE UnitCost IS NULL OR UnitCost < 0)
        THROW 50400, N'Hay líneas con costo negativo.', 1;

    DECLARE @SessionStatus TINYINT;
    IF @CashBoxSessionId IS NOT NULL
    BEGIN
        SELECT @SessionStatus = [Status]
        FROM [Finance].[CashBoxSession]
        WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

        IF @SessionStatus IS NULL
            THROW 50404, N'La sesión de caja indicada no existe.', 1;

        IF @SessionStatus <> 1
            THROW 50422, N'No se puede mover dinero en una sesión de caja cerrada.', 1;
    END

    /* Proveedor: si viene del maestro, se valida y se toma su nombre; si no, se conserva el texto libre. */
    DECLARE @ResolvedSupplierName NVARCHAR(150) = NULLIF(LTRIM(RTRIM(@SupplierName)), '');
    IF @SupplierId IS NOT NULL AND @SupplierId > 0
    BEGIN
        SELECT @ResolvedSupplierName = s.Name
        FROM [Inventory].[Supplier] AS s
        WHERE s.SupplierId = @SupplierId AND s.TenantId = @TenantId AND s.IsActive = 1;

        IF @ResolvedSupplierName IS NULL
            THROW 50404, N'El proveedor seleccionado no existe o está inactivo.', 1;
    END
    ELSE
        SET @SupplierId = NULL;

    SET @SupplierName = @ResolvedSupplierName;

    DECLARE @Reason NVARCHAR(250) = NULLIF(LTRIM(RTRIM(@Notes)), '');
    IF @Reason IS NOT NULL AND LEN(@Reason) > 250
        SET @Reason = LEFT(@Reason, 250);

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        DECLARE @PurchaseId INT;

        INSERT INTO [Inventory].[Purchase] (TenantId, LocationId, PurchaseType, SupplierId, SupplierName, ReferenceDoc, CashBoxSessionId, Notes, CreatedOn, CreatedBy)
        VALUES (@TenantId, @LocationId, @PurchaseType, @SupplierId, @SupplierName, @ReferenceDoc, @CashBoxSessionId, @Notes, SYSUTCDATETIME(), @CreatedBy);

        SET @PurchaseId = SCOPE_IDENTITY();

        DECLARE @Row INT = 1;
        DECLARE @RowCount INT = (SELECT COUNT(*) FROM @Items);
        DECLARE @ProductId INT;
        DECLARE @Quantity DECIMAL(12,2);
        DECLARE @UnitCost DECIMAL(18,4);
        DECLARE @CurrentStock DECIMAL(12,2);
        DECLARE @NewStock DECIMAL(12,2);
        DECLARE @LineTotal DECIMAL(18,4);

        WHILE @Row <= @RowCount
        BEGIN
            SELECT @ProductId = ProductId, @Quantity = Quantity, @UnitCost = UnitCost
            FROM @Items
            WHERE RowNumber = @Row;

            SELECT @CurrentStock = CurrentStock
            FROM [Inventory].[Product]
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND IsActive = 1;

            IF @CurrentStock IS NULL
                THROW 50404, N'Alguno de los productos no existe o está inactivo.', 1;

            IF @PurchaseType = 'Compra'
                SET @NewStock = @CurrentStock + @Quantity;
            ELSE
            BEGIN
                IF @CurrentStock < @Quantity
                    THROW 50422, N'Stock insuficiente para devolver el producto al proveedor.', 1;

                SET @NewStock = @CurrentStock - @Quantity;
            END

            SET @LineTotal = @UnitCost * @Quantity;

            UPDATE [Inventory].[Product]
            SET CurrentStock = @NewStock,
                CostPrice = CASE WHEN @PurchaseType = 'Compra' AND @UnitCost > 0 THEN @UnitCost ELSE CostPrice END
            WHERE ProductId = @ProductId AND TenantId = @TenantId;

            INSERT INTO [Inventory].[PurchaseItem] (PurchaseId, ProductId, Quantity, UnitCost, LineTotal)
            VALUES (@PurchaseId, @ProductId, @Quantity, @UnitCost, @LineTotal);

            INSERT INTO [Inventory].[InventoryMovement]
                (TenantId, LocationId, ProductId, MovementType, Quantity, PreviousStock, NewStock,
                 UnitCost, TotalCost, Reason, ReferenceDoc, CreatedOn, CreatedBy)
            VALUES
                (@TenantId, @LocationId, @ProductId, @PurchaseType, @Quantity, @CurrentStock, @NewStock,
                 @UnitCost, @LineTotal, @Reason, @ReferenceDoc, SYSUTCDATETIME(), @CreatedBy);

            SET @Row += 1;
        END

        DECLARE @TotalAmount DECIMAL(18,4) = (SELECT SUM(Quantity * UnitCost) FROM @Items);

        UPDATE [Inventory].[Purchase]
        SET TotalAmount = @TotalAmount
        WHERE PurchaseId = @PurchaseId;

        IF @CashBoxSessionId IS NOT NULL AND @TotalAmount <> 0
        BEGIN
            DECLARE @AdjustmentType NVARCHAR(10) = CASE WHEN @PurchaseType = 'Compra' THEN 'OUT' ELSE 'IN' END;
            DECLARE @AdjustReason NVARCHAR(250) =
                CASE
                    WHEN @PurchaseType = 'Compra'
                        THEN 'Compra de inventario' + ISNULL(N' · ' + NULLIF(LTRIM(RTRIM(@SupplierName)), ''), '')
                    ELSE 'Devolución a proveedor' + ISNULL(N' · ' + NULLIF(LTRIM(RTRIM(@SupplierName)), ''), '')
                END;

            DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, 'NIO', 'NIO');
            DECLARE @AmountInBase DECIMAL(18,4) = @TotalAmount * @Rate;
            DECLARE @SourceCode NVARCHAR(30) = CASE WHEN @PurchaseType = 'Compra' THEN 'Compra' ELSE 'Proveedor' END;

            INSERT INTO [Finance].[CashBoxAdjustment]
                (TenantId, CashBoxSessionId, AdjustmentType, SourceCode, CurrencyCode, Amount, ExchangeRate, AmountInBase, Reason, RecordedAt, RecordedBy)
            VALUES
                (@TenantId, @CashBoxSessionId, @AdjustmentType, @SourceCode, 'NIO', @TotalAmount, @Rate, @AmountInBase, @AdjustReason, SYSUTCDATETIME(), @CreatedBy);

            IF @AdjustmentType = 'IN'
                UPDATE [Finance].[CashBoxSession]
                SET TotalInAdjustmentsBase = TotalInAdjustmentsBase + @AmountInBase
                WHERE CashBoxSessionId = @CashBoxSessionId;
            ELSE
                UPDATE [Finance].[CashBoxSession]
                SET TotalOutAdjustmentsBase = TotalOutAdjustmentsBase + @AmountInBase
                WHERE CashBoxSessionId = @CashBoxSessionId;
        END

        SET @InsertedId = @PurchaseId;

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
