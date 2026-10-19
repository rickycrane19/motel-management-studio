/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspRecordFinancialLoss]
   SUBDOMAIN:   FinancialLoss
   DESCRIPTION: Registra una pérdida del negocio (daño de cuarto, minibar mal gestionado,
                faltante de caja u otro). Es un registro inmutable. Si se indica CashBoxSessionId
                con sesión abierta, inserta también el ajuste de caja (OUT, SourceCode='Perdida')
                en la MISMA transacción, alineado a [Finance].[uspAddCashAdjustment].

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Cuarto, estancia o sesión de caja no existe)
    50422 -> Conflict/Negocio          (Sesión de caja cerrada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspRecordFinancialLoss] (
    @TenantId         UNIQUEIDENTIFIER,
    @LocationId       UNIQUEIDENTIFIER = NULL,
    @CategoryCode     NVARCHAR(30),      -- 'Habitacion', 'Minibar', 'Caja', 'Otro'
    @Description      NVARCHAR(300),
    @Amount           DECIMAL(18,4),
    @CurrencyCode     CHAR(3) = 'NIO',
    @RoomId           INT = NULL,
    @RoomStayId       INT = NULL,
    @CashBoxSessionId INT = NULL,        -- Si se descuenta del efectivo del turno activo
    @RecordedBy       INT = NULL,
    @InsertedId       INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @CategoryCode IS NULL OR LTRIM(RTRIM(@CategoryCode)) NOT IN ('Habitacion', 'Minibar', 'Caja', 'Otro')
        THROW 50400, N'La categoría de la pérdida debe ser Habitacion, Minibar, Caja u Otro.', 1;

    IF NULLIF(LTRIM(RTRIM(@Description)), '') IS NULL
        THROW 50400, N'La descripción de la pérdida es obligatoria.', 1;

    IF @Amount IS NULL OR @Amount <= 0
        THROW 50400, N'El monto de la pérdida debe ser mayor a cero.', 1;

    SET @CategoryCode = UPPER(LEFT(LTRIM(RTRIM(@CategoryCode)), 1)) + LOWER(SUBSTRING(LTRIM(RTRIM(@CategoryCode)), 2, 29));

    IF @RoomId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE RoomId = @RoomId AND TenantId = @TenantId)
        THROW 50404, N'El cuarto indicado no existe.', 1;

    IF @RoomStayId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM [Service].[RoomStay] WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId)
        THROW 50404, N'La estancia indicada no existe.', 1;

    -- Sesión de caja: mismas reglas del ajuste manual de caja
    IF @CashBoxSessionId IS NOT NULL AND @CashBoxSessionId > 0
    BEGIN
        DECLARE @SessionStatus TINYINT;
        SELECT @SessionStatus = [Status]
        FROM [Finance].[CashBoxSession]
        WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

        IF @SessionStatus IS NULL
            THROW 50404, N'La sesión de caja indicada no existe.', 1;

        IF @SessionStatus <> 1
            THROW 50422, N'La sesión de caja está cerrada. La pérdida quedará solo en reportes: no se descontó de ningún turno.', 1;
    END
    ELSE
        SET @CashBoxSessionId = NULL; -- normaliza cero/negativo a sin caja

    DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, @CurrencyCode, 'NIO');
    DECLARE @AmountInBase DECIMAL(18,4) = @Amount * @Rate;
    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Finance].[FinancialLoss]
        (
            TenantId,
            LocationId,
            CategoryCode,
            RoomId,
            RoomStayId,
            [Description],
            Amount,
            CurrencyCode,
            ExchangeRate,
            AmountInBase,
            CashBoxSessionId,
            RecordedAtUtc,
            CreatedBy
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @CategoryCode,
            @RoomId,
            @RoomStayId,
            LTRIM(RTRIM(@Description)),
            @Amount,
            @CurrencyCode,
            @Rate,
            @AmountInBase,
            @CashBoxSessionId,
            @NowUtc,
            @RecordedBy
        );

        SET @InsertedId = SCOPE_IDENTITY();

        -- Descuenta del efectivo del turno activo (misma mecánica que uspAddCashAdjustment):
        -- el ajuste queda con SourceCode='Perdida' para que la caja cuadre y los reportes
        -- consolidados lo lean por fuente FinancialLoss (no doble contado como gasto manual).
        IF @CashBoxSessionId IS NOT NULL
        BEGIN
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
                'OUT',
                'Perdida',
                @CurrencyCode,
                @Amount,
                @Rate,
                @AmountInBase,
                LEFT(CONCAT(N'Pérdida: ', @Description), 250),
                @NowUtc,
                @RecordedBy
            );

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
