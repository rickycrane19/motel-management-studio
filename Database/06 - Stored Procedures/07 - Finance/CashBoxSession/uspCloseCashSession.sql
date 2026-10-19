/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspCloseCashSession]
   SUBDOMAIN:   CashBoxSession
   DESCRIPTION: Realiza el cierre de turno y caja: compara el efectivo real contado contra
                el flujo del sistema (apertura + ventas + entradas - salidas) para calcular
                la diferencia exacta (faltante o sobrante).

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Sesión de caja no existe)
    50422 -> Conflict/Negocio          (Sesión ya cerrada)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspCloseCashSession] (
    @TenantId          UNIQUEIDENTIFIER,
    @CashBoxSessionId  INT,
    @ClosingActualBase DECIMAL(18,4),
    @Notes             NVARCHAR(500) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @CashBoxSessionId IS NULL OR @CashBoxSessionId <= 0
        THROW 50400, N'El ID de la sesión de caja no es válido.', 1;

    DECLARE @Status TINYINT;
    DECLARE @OpeningBal DECIMAL(18,4);
    DECLARE @Sales DECIMAL(18,4);
    DECLARE @InAdj DECIMAL(18,4);
    DECLARE @OutAdj DECIMAL(18,4);

    SELECT 
        @Status = [Status],
        @OpeningBal = OpeningBalanceBase,
        @Sales = TotalSalesBase,
        @InAdj = TotalInAdjustmentsBase,
        @OutAdj = TotalOutAdjustmentsBase
    FROM [Finance].[CashBoxSession]
    WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

    IF @Status IS NULL
        THROW 50404, N'La sesión de caja no existe.', 1;

    IF @Status <> 1
        THROW 50422, N'La sesión de caja ya se encuentra cerrada.', 1;

    DECLARE @ClosingCalculatedBase DECIMAL(18,4) = @OpeningBal + @Sales + @InAdj - @OutAdj;
    DECLARE @DifferenceBase DECIMAL(18,4) = @ClosingActualBase - @ClosingCalculatedBase;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        UPDATE [Finance].[CashBoxSession]
        SET [Status] = 2, -- Cerrada
            ClosedAtUtc = SYSUTCDATETIME(),
            ClosingCalculatedBase = @ClosingCalculatedBase,
            ClosingActualBase = @ClosingActualBase,
            DifferenceBase = @DifferenceBase,
            Notes = ISNULL(@Notes, Notes)
        WHERE CashBoxSessionId = @CashBoxSessionId AND TenantId = @TenantId;

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
