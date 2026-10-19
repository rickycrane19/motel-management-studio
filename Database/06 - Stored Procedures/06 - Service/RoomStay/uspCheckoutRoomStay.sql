/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspCheckoutRoomStay]
   SUBDOMAIN:   RoomStay
   DESCRIPTION: Registra la salida (Check-out) de una habitación: cobra el total de la cuenta
                (estancia + extensiones + consumos), envía el cuarto a Limpieza (2) e impacta
                la sesión de caja del turno activo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Estancia no existe)
    50422 -> Conflict/Negocio          (Estancia ya finalizada, pago menor al total)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspCheckoutRoomStay] (
    @TenantId         UNIQUEIDENTIFIER,
    @RoomStayId       INT,
    @PaidAmount       DECIMAL(18,4),
    @PaymentMethod    NVARCHAR(50),        -- 'Efectivo NIO', 'Efectivo USD', 'Tarjeta', etc.
    @CashBoxSessionId INT = NULL,
    @UserId           INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomStayId IS NULL OR @RoomStayId <= 0
        THROW 50400, N'El ID de la estancia no es válido.', 1;

    DECLARE @StayStatus TINYINT;
    DECLARE @RoomId INT;
    DECLARE @TotalAmount DECIMAL(18,4);

    SELECT 
        @StayStatus = [Status],
        @RoomId = RoomId,
        @TotalAmount = TotalAmount
    FROM [Service].[RoomStay]
    WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

    IF @StayStatus IS NULL
        THROW 50404, N'La estancia no existe.', 1;

    IF @StayStatus <> 1
        THROW 50422, N'La estancia ya fue finalizada o cancelada previamente.', 1;

    IF @PaidAmount < @TotalAmount
        THROW 50422, N'El monto pagado es menor al total adeudado de la cuenta.', 1;

    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Service].[RoomStay]
        SET [Status] = 2, -- Completada
            ActualEndTimeUtc = @NowUtc,
            PaidAmount = @PaidAmount,
            IsPaid = 1,
            PaymentMethod = @PaymentMethod,
            CashBoxSessionId = @CashBoxSessionId
        WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

        UPDATE [Service].[Room]
        SET [Status] = 2 -- Limpieza
        WHERE RoomId = @RoomId AND TenantId = @TenantId;

        IF @CashBoxSessionId IS NOT NULL AND @CashBoxSessionId > 0
        BEGIN
            UPDATE [Finance].[CashBoxSession]
            SET TotalSalesBase = TotalSalesBase + @TotalAmount
            WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;
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
