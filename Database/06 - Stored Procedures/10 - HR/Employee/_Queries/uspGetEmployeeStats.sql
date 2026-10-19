/* ══════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - HR MODULE ]

   PROCEDURE:   [HR].[uspGetEmployeeStats]
   SUBDOMAIN:   Employee
   DESCRIPTION: Contadores del directorio para las tarjetas de estadísticas del listado, sin
                traer los registros: total, vigentes (activos) e inactivos del tenant.
   ══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [HR].[uspGetEmployeeStats] (
    @TenantId UNIQUEIDENTIFIER
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        COUNT(*) AS TotalEmployees,
        ISNULL(SUM(CASE WHEN e.IsActive = 1 THEN 1 ELSE 0 END), 0) AS ActiveEmployees,
        ISNULL(SUM(CASE WHEN e.IsActive = 0 THEN 1 ELSE 0 END), 0) AS InactiveEmployees
    FROM [HR].[Employee] AS e
    WHERE e.TenantId = @TenantId;
END
GO
