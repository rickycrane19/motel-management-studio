/* ══════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - INVENTORY MODULE ]

   PROCEDURE:   [Inventory].[uspCreateCustomerReturn]
   SUBDOMAIN:   CustomerReturn
   DESCRIPTION: Registra la devolución de productos por parte de un cliente.
                Por cada línea reingresa el stock (Kardex tipo 'DevolucionCliente')
                y, si se indica una sesión de caja abierta, registra el
                reembolso en efectivo como ajuste 'OUT' (dinero que sale de caja).

   ────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos / JSON malformado)
    50404 -> Not Found                 (Producto o sesión de caja no existe)
    50422 -> Conflict/Negocio          (Sesión cerrada)
   ════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Inventory].[uspCreateCustomerReturn] (
    @TenantId         UNIQUEIDENTIFIER,
    @LocationId       UNIQUEIDENTIFIER = NULL,
    @CustomerName     NVARCHAR(150) = NULL,
    @RoomStayId       INT           = NULL,
    @CashBoxSessionId INT           = NULL,
    @Notes            NVARCHAR(500) = NULL,
    @ItemsJson        NVARCHAR(MAX),  -- [{"ProductId":1,"Quantity":1,"UnitPrice":45}]
    @CreatedBy        INT           = NULL,
    @InsertedId       INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    DECLARE @Items TABLE
    (
        RowNumber INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ProductId INT           NOT NULL,
        Quantity  DECIMAL(12,2) NOT NULL,
        UnitPrice DECIMAL(18,4) NOT NULL
    );

    IF @ItemsJson IS NULL
        THROW 50400, N'La devolución necesita al menos una línea de producto.', 1;

    BEGIN TRY
        INSERT INTO @Items (ProductId, Quantity, UnitPrice)
        SELECT j.ProductId, j.Quantity, j.UnitPrice
        FROM OPENJSON(@ItemsJson)
        WITH (
            ProductId INT           '$.ProductId',
            Quantity  DECIMAL(12,2) '$.Quantity',
            UnitPrice DECIMAL(18,4) '$.UnitPrice'
        ) AS j;
    END TRY
    BEGIN CATCH
        THROW 50400, N'El formato de las líneas de la devolución no es válido.', 1;
    END CATCH

    IF NOT EXISTS (SELECT 1 FROM @Items)
        THROW 50400, N'La devolución necesita al menos una línea de producto.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE ProductId IS NULL OR ProductId <= 0)
        THROW 50400, N'Hay líneas con un ID de producto no válido.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE Quantity IS NULL OR Quantity <= 0)
        THROW 50400, N'Hay líneas con cantidad menor o igual a cero.', 1;

    IF EXISTS (SELECT 1 FROM @Items WHERE UnitPrice IS NULL OR UnitPrice < 0)
        THROW 50400, N'Hay líneas con precio negativo.', 1;

    DECLARE @SessionStatus TINYINT;
    IF @CashBoxSessionId IS NOT NULL
    BEGIN
        SELECT @SessionStatus = [Status]
        FROM [Finance].[CashBoxSession]
        WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

        IF @SessionStatus IS NULL
            THROW 50404, N'La sesión de caja indicada no existe.', 1;

        IF @SessionStatus <> 1
            THROW 50422, N'No se puede devolver dinero en una sesión de caja cerrada.', 1;
    END

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        DECLARE @CustomerReturnId INT;

        INSERT INTO [Inventory].[CustomerReturn] (TenantId, LocationId, CustomerName, RoomStayId, CashBoxSessionId, Notes, CreatedOn, CreatedBy)
        VALUES (@TenantId, @LocationId, @CustomerName, @RoomStayId, @CashBoxSessionId, @Notes, SYSUTCDATETIME(), @CreatedBy);

        SET @CustomerReturnId = SCOPE_IDENTITY();

        DECLARE @Row INT = 1;
        DECLARE @RowCount INT = (SELECT COUNT(*) FROM @Items);
        DECLARE @ProductId INT;
        DECLARE @Quantity DECIMAL(12,2);
        DECLARE @UnitPrice DECIMAL(18,4);
        DECLARE @CurrentStock DECIMAL(12,2);
        DECLARE @NewStock DECIMAL(12,2);
        DECLARE @LineTotal DECIMAL(18,4);
        DECLARE @Reason NVARCHAR(250) = 'Devolución a cliente';

        WHILE @Row <= @RowCount
        BEGIN
            SELECT @ProductId = ProductId, @Quantity = Quantity, @UnitPrice = UnitPrice
            FROM @Items
            WHERE RowNumber = @Row;

            SELECT @CurrentStock = CurrentStock
            FROM [Inventory].[Product]
            WHERE ProductId = @ProductId AND TenantId = @TenantId AND IsActive = 1;

            IF @CurrentStock IS NULL
                THROW 50404, N'Alguno de los productos no existe o está inactivo.', 1;

            SET @NewStock = @CurrentStock + @Quantity;
            SET @LineTotal = @UnitPrice * @Quantity;

            UPDATE [Inventory].[Product]
            SET CurrentStock = @NewStock
            WHERE ProductId = @ProductId AND TenantId = @TenantId;

            INSERT INTO [Inventory].[CustomerReturnItem] (CustomerReturnId, ProductId, Quantity, UnitPrice, LineTotal)
            VALUES (@CustomerReturnId, @ProductId, @Quantity, @UnitPrice, @LineTotal);

            INSERT INTO [Inventory].[InventoryMovement]
                (TenantId, LocationId, ProductId, MovementType, Quantity, PreviousStock, NewStock,
                 UnitCost, TotalCost, Reason, ReferenceDoc, RoomStayId, CreatedOn, CreatedBy)
            VALUES
                (@TenantId, @LocationId, @ProductId, 'DevolucionCliente', @Quantity, @CurrentStock, @NewStock,
                 @UnitPrice, @LineTotal, @Reason, NULLIF(LTRIM(RTRIM(@CustomerName)), N''), @RoomStayId, SYSUTCDATETIME(), @CreatedBy);

            SET @Row += 1;
        END

        DECLARE @TotalRefund DECIMAL(18,4) = (SELECT SUM(Quantity * UnitPrice) FROM @Items);

        UPDATE [Inventory].[CustomerReturn]
        SET TotalRefund = @TotalRefund
        WHERE CustomerReturnId = @CustomerReturnId;

        IF @CashBoxSessionId IS NOT NULL AND @TotalRefund <> 0
        BEGIN
            DECLARE @AdjustReason NVARCHAR(250) = 'Devolución a cliente' + ISNULL(N' · ' + NULLIF(LTRIM(RTRIM(@CustomerName)), ''), '');

            DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, 'NIO', 'NIO');
            DECLARE @AmountInBase DECIMAL(18,4) = @TotalRefund * @Rate;

            INSERT INTO [Finance].[CashBoxAdjustment]
                (TenantId, CashBoxSessionId, AdjustmentType, SourceCode, CurrencyCode, Amount, ExchangeRate, AmountInBase, Reason, RecordedAt, RecordedBy)
            VALUES
                (@TenantId, @CashBoxSessionId, 'OUT', 'Cliente', 'NIO', @TotalRefund, @Rate, @AmountInBase, @AdjustReason, SYSUTCDATETIME(), @CreatedBy);

            UPDATE [Finance].[CashBoxSession]
            SET TotalOutAdjustmentsBase = TotalOutAdjustmentsBase + @AmountInBase
            WHERE CashBoxSessionId = @CashBoxSessionId;
        END

        SET @InsertedId = @CustomerReturnId;

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
