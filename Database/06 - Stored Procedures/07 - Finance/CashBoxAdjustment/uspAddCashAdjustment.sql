/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspAddCashAdjustment]
   SUBDOMAIN:   CashBoxAdjustment
   DESCRIPTION: Registra un ajuste de efectivo (Entrada o Salida/Gasto) en la sesión de caja activa.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Sesión de caja no existe)
    50422 -> Conflict/Negocio          (Sesión cerrada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspAddCashAdjustment] (
    @TenantId         UNIQUEIDENTIFIER,
    @CashBoxSessionId INT,
    @AdjustmentType   NVARCHAR(10),     -- 'IN' o 'OUT'
    @CurrencyCode     CHAR(3),          -- 'NIO', 'USD', 'CRC'
    @Amount           DECIMAL(18,4),
    @Reason           NVARCHAR(250),
    @SourceCode       NVARCHAR(60) = 'AjusteManual', -- Origen: 'AjusteManual','Propina','Comision','Otro','Compra','Proveedor','Cliente','Nomina','Perdida'...
    @RecordedBy       INT = NULL,
    @InsertedId       INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @CashBoxSessionId IS NULL OR @CashBoxSessionId <= 0
        THROW 50400, N'El ID de la sesión de caja no es válido.', 1;

    IF @AdjustmentType NOT IN ('IN', 'OUT')
        THROW 50400, N'El tipo de ajuste debe ser IN (Entrada) o OUT (Salida).', 1;

    IF @Amount IS NULL OR @Amount <= 0
        THROW 50400, N'El monto del ajuste debe ser mayor a cero.', 1;

    IF NULLIF(LTRIM(RTRIM(@Reason)), '') IS NULL
        THROW 50400, N'El motivo o justificación del ajuste de efectivo es obligatorio.', 1;

    -- Normaliza el origen: vacío = ajuste manual de caja (los reportes distinguen fuentes por SourceCode).
    SET @SourceCode = UPPER(LEFT(LTRIM(RTRIM(@SourceCode)), 1)) + LOWER(SUBSTRING(LTRIM(RTRIM(@SourceCode)), 2, 59));
    IF @SourceCode NOT IN ('AjusteManual', 'Propina', 'Comision', 'Otro', 'Compra', 'Proveedor', 'Cliente', 'Nomina', 'Perdida')
        SET @SourceCode = 'AjusteManual';
    IF NULLIF(LTRIM(RTRIM(@SourceCode)), '') IS NULL
        SET @SourceCode = 'AjusteManual';

    DECLARE @Status TINYINT;
    SELECT @Status = [Status]
    FROM [Finance].[CashBoxSession]
    WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

    IF @Status IS NULL
        THROW 50404, N'La sesión de caja no existe.', 1;

    IF @Status <> 1
        THROW 50422, N'No se pueden registrar ajustes en una sesión de caja cerrada.', 1;

    DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, @CurrencyCode, 'NIO');
    DECLARE @AmountInBase DECIMAL(18,4) = @Amount * @Rate;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Finance].[CashBoxAdjustment]
        (
            TenantId,
            CashBoxSessionId,
            AdjustmentType,
            SourceCode,
            CurrencyCode,
            Amount,
            ExchangeRate,
            AmountInBase,
            Reason,
            RecordedAt,
            RecordedBy
        )
        VALUES
        (
            @TenantId,
            @CashBoxSessionId,
            @AdjustmentType,
            ISNULL(@SourceCode, N'AjusteManual'),
            @CurrencyCode,
            @Amount,
            @Rate,
            @AmountInBase,
            @Reason,
            SYSUTCDATETIME(),
            @RecordedBy
        );

        SET @InsertedId = SCOPE_IDENTITY();

        IF @AdjustmentType = 'IN'
        BEGIN
            UPDATE [Finance].[CashBoxSession]
            SET TotalInAdjustmentsBase = TotalInAdjustmentsBase + @AmountInBase
            WHERE CashBoxSessionId = @CashBoxSessionId;
        END
        ELSE
        BEGIN
            UPDATE [Finance].[CashBoxSession]
            SET TotalOutAdjustmentsBase = TotalOutAdjustmentsBase + @AmountInBase
            WHERE CashBoxSessionId = @CashBoxSessionId;
        END

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
