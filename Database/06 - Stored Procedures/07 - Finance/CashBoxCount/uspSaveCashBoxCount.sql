/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspSaveCashBoxCount]
   SUBDOMAIN:   CashBoxCount
   DESCRIPTION: Registra o actualiza el conteo físico de una denominación (moneda o billete)
                para Apertura (1), Pre-Arqueo (2) o Cierre (3) con conversión a moneda base NIO.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Denominación no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspSaveCashBoxCount] (
    @TenantId         UNIQUEIDENTIFIER,
    @CashBoxSessionId INT,
    @CountTypeId      INT, -- 1=Apertura, 2=Pre-Arqueo, 3=Cierre
    @DenominationId   INT,
    @Count            INT,
    @RecordedBy       INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @CashBoxSessionId IS NULL OR @CashBoxSessionId <= 0
        THROW 50400, N'El ID de la sesión de caja no es válido.', 1;

    IF @DenominationId IS NULL OR @DenominationId <= 0
        THROW 50400, N'El ID de la denominación no es válido.', 1;

    IF @Count < 0
        THROW 50400, N'La cantidad de billetes/monedas no puede ser negativa.', 1;

    DECLARE @DenomValue DECIMAL(18,4);
    DECLARE @CurrencyCode CHAR(3);

    SELECT @DenomValue = [Value], @CurrencyCode = CurrencyCode
    FROM [Finance].[CashBoxDenomination]
    WHERE DenominationId = @DenominationId AND IsActive = 1;

    IF @DenomValue IS NULL
        THROW 50404, N'La denominación indicada no existe o está inactiva.', 1;

    DECLARE @SubTotal DECIMAL(18,4) = @Count * @DenomValue;
    DECLARE @Rate DECIMAL(18,8) = [Configuration].[fnGetExchangeRateValue](@TenantId, @CurrencyCode, 'NIO');
    DECLARE @SubTotalInBase DECIMAL(18,4) = @SubTotal * @Rate;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        IF EXISTS (
            SELECT 1
            FROM [Finance].[CashBoxCount]
            WHERE CashBoxSessionId = @CashBoxSessionId
              AND CountTypeId = @CountTypeId
              AND DenominationId = @DenominationId
        )
        BEGIN
            UPDATE [Finance].[CashBoxCount]
            SET [Count] = @Count,
                SubTotal = @SubTotal,
                SubTotalInBase = @SubTotalInBase,
                RecordedAt = SYSUTCDATETIME(),
                RecordedBy = @RecordedBy
            WHERE CashBoxSessionId = @CashBoxSessionId
              AND CountTypeId = @CountTypeId
              AND DenominationId = @DenominationId;
        END
        ELSE
        BEGIN
            INSERT INTO [Finance].[CashBoxCount]
            (
                TenantId,
                CashBoxSessionId,
                CountTypeId,
                DenominationId,
                [Count],
                SubTotal,
                SubTotalInBase,
                RecordedAt,
                RecordedBy
            )
            VALUES
            (
                @TenantId,
                @CashBoxSessionId,
                @CountTypeId,
                @DenominationId,
                @Count,
                @SubTotal,
                @SubTotalInBase,
                SYSUTCDATETIME(),
                @RecordedBy
            );
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
