/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspOpenCashSession]
   SUBDOMAIN:   CashBoxSession
   DESCRIPTION: Abre una nueva sesión de caja y turno operativo con su saldo inicial en base.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50422 -> Conflict/Negocio          (Caja o usuario ya tienen una sesión abierta)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspOpenCashSession] (
    @TenantId           UNIQUEIDENTIFIER,
    @LocationId         UNIQUEIDENTIFIER = NULL,
    @CashBoxId          INT,
    @UserId             INT,
    @ShiftName          NVARCHAR(50),
    @OpeningBalanceBase DECIMAL(18,4) = 0,
    @Notes              NVARCHAR(500) = NULL,
    @InsertedId         INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @CashBoxId IS NULL OR @CashBoxId <= 0
        THROW 50400, N'Debes seleccionar una caja registradora válida.', 1;

    IF @UserId IS NULL OR @UserId <= 0
        THROW 50400, N'El ID de usuario es obligatorio.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Finance].[CashBoxSession]
        WHERE TenantId = @TenantId
          AND CashBoxId = @CashBoxId
          AND [Status] = 1
    )
    BEGIN
        THROW 50422, N'La caja seleccionada ya tiene un turno/sesión abierto actualmente.', 1;
    END

    IF EXISTS (
        SELECT 1
        FROM [Finance].[CashBoxSession]
        WHERE TenantId = @TenantId
          AND UserId = @UserId
          AND [Status] = 1
    )
    BEGIN
        THROW 50422, N'El usuario ya tiene una sesión de caja activa en el sistema.', 1;
    END

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [Finance].[CashBoxSession]
        (
            TenantId,
            LocationId,
            CashBoxId,
            UserId,
            ShiftName,
            OpenedAtUtc,
            [Status],
            OpeningBalanceBase,
            TotalSalesBase,
            TotalInAdjustmentsBase,
            TotalOutAdjustmentsBase,
            ClosingCalculatedBase,
            ClosingActualBase,
            DifferenceBase,
            Notes
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            @CashBoxId,
            @UserId,
            ISNULL(NULLIF(LTRIM(RTRIM(@ShiftName)), ''), N'Turno Regular'),
            SYSUTCDATETIME(),
            1, -- Abierta
            @OpeningBalanceBase,
            0,
            0,
            0,
            0,
            0,
            0,
            @Notes
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
