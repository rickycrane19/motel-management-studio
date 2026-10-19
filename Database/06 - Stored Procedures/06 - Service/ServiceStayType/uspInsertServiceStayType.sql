/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspInsertServiceStayType]
   SUBDOMAIN:   ServiceStayType
   DESCRIPTION: Registra un nuevo tipo de servicio de estancia o tarifa por tiempo.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspInsertServiceStayType] (
    @TenantId          UNIQUEIDENTIFIER,
    @RoomTypeId        INT = NULL,
    @Name              NVARCHAR(100),
    @DurationHours     DECIMAL(5,2),
    @Price             DECIMAL(18,4),
    @IsExtension       BIT = 0,
    @InsertedId        INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Name)), '') IS NULL
        THROW 50400, N'El nombre del servicio de estancia es obligatorio.', 1;

    IF @DurationHours IS NULL OR @DurationHours <= 0
        THROW 50400, N'La duración en horas debe ser mayor a 0.', 1;

    IF @Price IS NULL OR @Price < 0
        THROW 50400, N'El precio no puede ser negativo.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[ServiceStayType]
        (
            TenantId,
            RoomTypeId,
            Name,
            DurationHours,
            Price,
            IsExtension,
            IsActive
        )
        VALUES
        (
            @TenantId,
            @RoomTypeId,
            LTRIM(RTRIM(@Name)),
            @DurationHours,
            @Price,
            @IsExtension,
            1
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
