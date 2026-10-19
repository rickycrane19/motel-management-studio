/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspUpdateRoom]
   SUBDOMAIN:   Room
   DESCRIPTION: Actualiza datos de una habitación existente.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Habitación no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspUpdateRoom] (
    @TenantId    UNIQUEIDENTIFIER,
    @RoomId      INT,
    @RoomNumber  NVARCHAR(20),
    @RoomTypeId  INT,
    @FloorNumber INT = 1,
    @Notes       NVARCHAR(200) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomId IS NULL OR @RoomId <= 0
        THROW 50400, N'El RoomId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@RoomNumber)), '') IS NULL
        THROW 50400, N'El número de habitación es obligatorio.', 1;

    IF @RoomTypeId IS NULL OR @RoomTypeId <= 0
        THROW 50400, N'El tipo de habitación no es válido.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Service].[Room]
        SET RoomNumber = LTRIM(RTRIM(@RoomNumber)),
            RoomTypeId = @RoomTypeId,
            FloorNumber = @FloorNumber,
            Notes = @Notes
        WHERE RoomId = @RoomId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'La habitación indicada no existe.', 1;

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
