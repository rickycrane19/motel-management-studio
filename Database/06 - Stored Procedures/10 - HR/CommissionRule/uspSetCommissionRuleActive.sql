/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspSetCommissionRuleActive]
   SUBDOMAIN:   CommissionRule
   DESCRIPTION: Activa o desactiva una regla de comisión sin borrarla; una regla inactiva no se
                considera al resolver la comisión del reporte de rendimiento por cajero.

   ──────────────────────────────────────────────────────────────────────────────────────────────
   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Regla no existe)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspSetCommissionRuleActive] (
    @TenantId UNIQUEIDENTIFIER,
    @RuleId   INT,
    @IsActive BIT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF @RuleId IS NULL OR @RuleId <= 0
        THROW 50400, N'La regla de comisión indicada no es válida.', 1;

    IF @IsActive IS NULL
        THROW 50400, N'Debes indicar el estado de la regla de comisión.', 1;

    UPDATE [HR].[CommissionRule]
    SET IsActive = @IsActive
    WHERE RuleId = @RuleId AND TenantId = @TenantId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'La regla de comisión indicada no existe.', 1;
END
GO
