/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspUpdateEmployee]
   SUBDOMAIN:   Employee
   DESCRIPTION: Actualiza los datos y modalidad de pago de un empleado.

   ────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Empleado no existe)
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspUpdateEmployee] (
    @TenantId     UNIQUEIDENTIFIER,
    @EmployeeId   INT,
    @FullName     NVARCHAR(150),
    @Position     NVARCHAR(100),
    @PaymentType  NVARCHAR(20),
    @Rate         DECIMAL(18,4),
    @CommissionRatePercent DECIMAL(5,2) = 0, -- % de comisión sobre ventas cobradas (0-100)
    @CurrencyCode CHAR(3) = 'NIO',
    @Phone        NVARCHAR(50) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @EmployeeId IS NULL OR @EmployeeId <= 0
        THROW 50400, N'El EmployeeId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre del empleado es obligatorio.', 1;

    IF @PaymentType NOT IN ('Hourly', 'Daily', 'PerShift', 'Weekly', 'Monthly')
        THROW 50400, N'La modalidad de pago no es válida.', 1;

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
        UPDATE [HR].[Employee]
        SET FullName = LTRIM(RTRIM(@FullName)),
            Position = LTRIM(RTRIM(@Position)),
            PaymentType = @PaymentType,
            Rate = @Rate,
            CommissionRatePercent = @CommissionRatePercent,
            CurrencyCode = @CurrencyCode,
            Phone = @Phone
        WHERE EmployeeId = @EmployeeId AND TenantId = @TenantId;

        IF @@ROWCOUNT = 0
            THROW 50404, N'El empleado indicado no existe.', 1;

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
