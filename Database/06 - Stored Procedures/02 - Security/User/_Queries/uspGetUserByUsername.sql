/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspGetUserByUsername]
   SUBDOMAIN:   User
   DESCRIPTION: Obtiene las credenciales y perfil de un usuario por su nombre de usuario.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspGetUserByUsername] (
    @Username NVARCHAR(50)
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP 1
        u.UserId,
        u.TenantId,
        t.Name AS TenantName,
        t.TimeZone,
        t.CurrencyCode,
        u.LocationId,
        u.Username,
        u.Email,
        u.PasswordHash,
        u.FullName,
        u.Role,
        u.IsActive
    FROM [Security].[User] AS u
    INNER JOIN [Tenant].[Tenants] AS t ON u.TenantId = t.TenantId
    WHERE u.Username = @Username
      AND u.IsActive = 1
      AND t.IsActive = 1;
END
GO
