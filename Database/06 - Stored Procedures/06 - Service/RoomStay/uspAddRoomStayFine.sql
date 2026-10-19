/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspAddRoomStayFine]
   SUBDOMAIN:   RoomStayFine
   DESCRIPTION: Registra una multa / cargo por daño u objeto faltante sobre una estancia activa.
                Convierte el monto a la moneda base (NIO) y lo acumula al total de la cuenta
                para que sea cobrado en el check-out e impacte la caja del turno.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Estancia o tipo de multa no existe)
    50422 -> Conflict/Negocio          (Estancia no activa)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspAddRoomStayFine] (
    @TenantId     UNIQUEIDENTIFIER,
    @RoomStayId   INT,
    @FineTypeId   INT = NULL,
    @Description  NVARCHAR(300),
    @Amount       DECIMAL(18,4),
    @CurrencyCode CHAR(3) = 'NIO',
    @RecordedBy   INT = NULL,
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

    IF @Amount IS NULL OR @Amount <= 0
        THROW 50400, N'El monto de la multa debe ser mayor a cero.', 1;

    IF NULLIF(LTRIM(RTRIM(@Description)), '') IS NULL
        THROW 50400, N'Debes indicar el motivo o descripción de la multa.', 1;

    DECLARE @StayStatus TINYINT;
    SELECT @StayStatus = [Status]
    FROM [Service].[RoomStay]
    WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

    IF @StayStatus IS NULL
        THROW 50404, N'La estancia no existe.', 1;

    IF @StayStatus <> 1
        THROW 50422, N'Solo se pueden registrar multas en estancias activas.', 1;

    IF @FineTypeId IS NOT NULL
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE FineTypeId = @FineTypeId AND TenantId = @TenantId AND IsActive = 1)
            THROW 50404, N'El tipo de multa indicado no existe o está inactivo.', 1;
    END

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
        INSERT INTO [Service].[RoomStayFine]
        (
            TenantId,
            RoomStayId,
            FineTypeId,
            Description,
            Amount,
            CurrencyCode,
            AmountInBase,
            ExchangeRate,
            IsWaived,
            RecordedBy,
            RecordedAtUtc
        )
        VALUES
        (
            @TenantId,
            @RoomStayId,
            @FineTypeId,
            LTRIM(RTRIM(@Description)),
            @Amount,
            @CurrencyCode,
            @AmountInBase,
            @Rate,
            0,
            @RecordedBy,
            @NowUtc
        );

        SET @InsertedId = SCOPE_IDENTITY();

        UPDATE [Service].[RoomStay]
        SET FinesTotal = FinesTotal + @AmountInBase,
            TotalAmount = TotalAmount + @AmountInBase
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
