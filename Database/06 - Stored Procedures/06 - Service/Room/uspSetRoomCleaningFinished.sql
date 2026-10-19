/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspSetRoomCleaningFinished]
   SUBDOMAIN:   Room
   DESCRIPTION: Finaliza la limpieza de un cuarto y lo regresa al estado Disponible (0).

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Habitación no existe)
    50422 -> Conflict/Negocio          (Habitación actualmente ocupada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspSetRoomCleaningFinished] (
    @TenantId UNIQUEIDENTIFIER,
    @RoomId   INT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomId IS NULL OR @RoomId <= 0
        THROW 50400, N'El ID de la habitación no es válido.', 1;

    DECLARE @CurrentStatus TINYINT;
    SELECT @CurrentStatus = [Status]
    FROM [Service].[Room]
    WHERE RoomId = @RoomId AND TenantId = @TenantId AND IsActive = 1;

    IF @CurrentStatus IS NULL
        THROW 50404, N'La habitación no existe.', 1;

    IF @CurrentStatus = 1
        THROW 50422, N'La habitación está ocupada con un cliente dentro. No se puede liberar.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Service].[Room]
        SET [Status] = 0, -- Disponible
            CurrentRoomStayId = NULL
        WHERE RoomId = @RoomId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'No se pudo actualizar el estado de la habitación.', 1;

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
