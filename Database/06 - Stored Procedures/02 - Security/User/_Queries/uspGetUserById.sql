/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspGetUserById]
   SUBDOMAIN:   User
   DESCRIPTION: Devuelve un usuario del tenant por su identificador (para editar su ficha).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspGetUserById] (
    @TenantId UNIQUEIDENTIFIER,
    @UserId   INT
)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        u.UserId,
        u.TenantId,
        u.LocationId,
        u.Username,
        u.Email,
        u.FullName,
        u.Role,
        u.IsActive,
        u.CreatedOn
    FROM [Security].[User] AS u
    WHERE u.TenantId = @TenantId
      AND u.UserId = @UserId;
END
GO
