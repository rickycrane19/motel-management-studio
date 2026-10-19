/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspInsertEmployee]
   SUBDOMAIN:   Employee
   DESCRIPTION: Registra un nuevo empleado con su modalidad de pago (Hourly, Daily, PerShift, Weekly, Monthly).

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspInsertEmployee] (
    @TenantId     UNIQUEIDENTIFIER,
    @LocationId   UNIQUEIDENTIFIER = NULL,
    @FullName     NVARCHAR(150),
    @Position     NVARCHAR(100),
    @PaymentType  NVARCHAR(20),     -- 'Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly'
    @Rate         DECIMAL(18,4),
    @CommissionRatePercent DECIMAL(5,2) = 0, -- % de comisión sobre ventas cobradas (0-100)
    @CurrencyCode CHAR(3) = 'NIO',
    @Phone        NVARCHAR(50) = NULL,
    @InsertedId   INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre del empleado es obligatorio.', 1;

    IF @PaymentType NOT IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')
        THROW 50400, N'La modalidad de pago no es válida. Debe ser Hourly, Daily, PerShift, Weekly o Monthly.', 1;

    IF @Rate < 0
        THROW 50400, N'La tarifa de pago no puede ser negativa.', 1;

    IF @CommissionRatePercent IS NULL
        SET @CommissionRatePercent = 0;

    IF @CommissionRatePercent < 0 OR @CommissionRatePercent > 100
        THROW 50400, N'La comisión sobre ventas debe estar entre 0 y 100 por ciento.', 1;

    DECLARE @IsTranStarted BIT = 0;
    IF @@TRANCOUNT = 0
    BEGIN
        BEGIN TRAN;
        SET @IsTranStarted = 1;
    END

    BEGIN TRY
        INSERT INTO [HR].[Employee]
        (
            TenantId,
            LocationId,
            FullName,
            Position,
            PaymentType,
            Rate,
            CommissionRatePercent,
            CurrencyCode,
            Phone,
            IsActive,
            CreatedOn
        )
        VALUES
        (
            @TenantId,
            @LocationId,
            LTRIM(RTRIM(@FullName)),
            LTRIM(RTRIM(@Position)),
            @PaymentType,
            @Rate,
            @CommissionRatePercent,
            @CurrencyCode,
            @Phone,
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
