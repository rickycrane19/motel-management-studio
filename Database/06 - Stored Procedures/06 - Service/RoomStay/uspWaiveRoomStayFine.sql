/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspWaiveRoomStayFine]
   SUBDOMAIN:   RoomStayFine
   DESCRIPTION: Anula (condona) una multa registrada sobre una estancia. Si la estancia sigue
                activa, descuenta el monto de la multa del total de la cuenta.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Multa no existe)
    50422 -> Conflict/Negocio          (La multa ya fue anulada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspWaiveRoomStayFine] (
    @TenantId     UNIQUEIDENTIFIER,
    @FineId       INT,
    @WaivedReason NVARCHAR(300) = NULL,
    @WaivedBy     INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @FineId IS NULL OR @FineId <= 0
        THROW 50400, N'El ID de la multa no es válido.', 1;

    DECLARE @RoomStayId INT;
    DECLARE @AmountInBase DECIMAL(18,4);
    DECLARE @IsWaived BIT;
    DECLARE @StayStatus TINYINT;

    SELECT
        @RoomStayId = f.RoomStayId,
        @AmountInBase = f.AmountInBase,
        @IsWaived = f.IsWaived
    FROM [Service].[RoomStayFine] AS f
    WHERE f.FineId = @FineId AND f.TenantId = @TenantId;

    IF @RoomStayId IS NULL
        THROW 50404, N'La multa indicada no existe.', 1;

    IF @IsWaived = 1
        THROW 50422, N'La multa ya se encuentra anulada.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Service].[RoomStayFine]
        SET IsWaived = 1,
            WaivedReason = @WaivedReason,
            WaivedBy = @WaivedBy,
            WaivedAtUtc = SYSUTCDATETIME()
        WHERE FineId = @FineId AND TenantId = @TenantId;

        SELECT @StayStatus = [Status]
        FROM [Service].[RoomStay]
        WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

        IF @StayStatus = 1
        BEGIN
            UPDATE [Service].[RoomStay]
            SET FinesTotal = CASE WHEN FinesTotal - @AmountInBase < 0 THEN 0 ELSE FinesTotal - @AmountInBase END,
                TotalAmount = CASE WHEN TotalAmount - @AmountInBase < 0 THEN 0 ELSE TotalAmount - @AmountInBase END
            WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;
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
