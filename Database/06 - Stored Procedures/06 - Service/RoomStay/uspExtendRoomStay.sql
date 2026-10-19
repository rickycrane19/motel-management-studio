/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspExtendRoomStay]
   SUBDOMAIN:   RoomStay
   DESCRIPTION: Extiende el tiempo del servicio de una habitación activa sumando horas extras
                al tiempo límite y acumulando el costo de extensión al total de la cuenta.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Estancia o tipo de extensión no existe)
    50422 -> Conflict/Negocio          (Estancia no activa)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspExtendRoomStay] (
    @TenantId          UNIQUEIDENTIFIER,
    @RoomStayId        INT,
    @ServiceStayTypeId INT,
    @CreatedBy         INT = NULL,
    @InsertedId        INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RoomStayId IS NULL OR @RoomStayId <= 0
        THROW 50400, N'El ID de la estancia no es válido.', 1;

    IF @ServiceStayTypeId IS NULL OR @ServiceStayTypeId <= 0
        THROW 50400, N'Debes seleccionar un tipo de extensión válido.', 1;

    DECLARE @StayStatus TINYINT;
    DECLARE @ExpectedEndTimeUtc DATETIME2;

    SELECT @StayStatus = [Status], @ExpectedEndTimeUtc = ExpectedEndTimeUtc
    FROM [Service].[RoomStay]
    WHERE RoomStayId = @RoomStayId AND TenantId = @TenantId;

    IF @StayStatus IS NULL
        THROW 50404, N'La estancia no existe.', 1;

    IF @StayStatus <> 1
        THROW 50422, N'Solo se pueden extender estancias que estén actualmente activas.', 1;

    DECLARE @ExtraHours DECIMAL(5,2);
    DECLARE @Cost DECIMAL(18,4);

    SELECT @ExtraHours = DurationHours, @Cost = Price
    FROM [Service].[ServiceStayType]
    WHERE ServiceStayTypeId = @ServiceStayTypeId AND TenantId = @TenantId AND IsActive = 1;

    IF @ExtraHours IS NULL
        THROW 50404, N'El tipo de extensión no existe o no está activo.', 1;

    DECLARE @NewExpectedEnd DATETIME2 = DATEADD(MINUTE, CAST(@ExtraHours * 60 AS INT), @ExpectedEndTimeUtc);
    DECLARE @NowUtc DATETIME2 = SYSUTCDATETIME();

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Service].[RoomStayExtension]
        (
            TenantId,
            RoomStayId,
            ServiceStayTypeId,
            ExtraHours,
            Cost,
            NewExpectedEndTimeUtc,
            CreatedBy,
            CreatedOnUtc
        )
        VALUES
        (
            @TenantId,
            @RoomStayId,
            @ServiceStayTypeId,
            @ExtraHours,
            @Cost,
            @NewExpectedEnd,
            @CreatedBy,
            @NowUtc
        );

        SET @InsertedId = SCOPE_IDENTITY();

        UPDATE [Service].[RoomStay]
        SET ExpectedEndTimeUtc = @NewExpectedEnd,
            ExtendedHours = ExtendedHours + @ExtraHours,
            ExtensionCost = ExtensionCost + @Cost,
            TotalAmount = TotalAmount + @Cost
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
