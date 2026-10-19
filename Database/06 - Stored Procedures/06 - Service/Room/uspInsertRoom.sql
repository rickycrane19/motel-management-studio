/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspInsertRoom]
   SUBDOMAIN:   Room
   DESCRIPTION: Registra una nueva habitación en el motel.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Tipo de habitación no existe)
    50422 -> Conflict/Negocio          (Ya existe habitación con el mismo número)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspInsertRoom] (
    @TenantId    UNIQUEIDENTIFIER,
    @LocationId  UNIQUEIDENTIFIER = NULL,
    @RoomNumber  NVARCHAR(20),
    @RoomTypeId  INT,
    @FloorNumber INT = 1,
    @Notes       NVARCHAR(200) = NULL,
    @InsertedId  INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@RoomNumber)), '') IS NULL
        THROW 50400, N'El número de habitación es obligatorio.', 1;

    IF @RoomTypeId IS NULL OR @RoomTypeId <= 0
        THROW 50400, N'El tipo de habitación no es válido.', 1;

    IF NOT EXISTS (SELECT 1 FROM [Service].[RoomType] WHERE RoomTypeId = @RoomTypeId AND TenantId = @TenantId AND IsActive = 1)
        THROW 50404, N'El tipo de habitación indicado no existe o está inactivo.', 1;

    IF EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = LTRIM(RTRIM(@RoomNumber)) AND IsActive = 1)
        THROW 50422, N'Ya existe una habitación con ese mismo número.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[Room]
        (
            TenantId,
            LocationId,
            RoomNumber,
            RoomTypeId,
            [Status],
            FloorNumber,
            Notes,
            IsActive,
            CreatedOn
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            LTRIM(RTRIM(@RoomNumber)),
            @RoomTypeId,
            0, -- Disponible
            @FloorNumber,
            @Notes,
            1,
            SYSUTCDATETIME()
        );

        SET @InsertedId = SCOPE_IDENTITY();

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
