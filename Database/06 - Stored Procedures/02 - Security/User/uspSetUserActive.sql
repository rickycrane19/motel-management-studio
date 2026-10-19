/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspSetUserActive]
   SUBDOMAIN:   User
   DESCRIPTION: Activa o desactiva un usuario. No permite que un usuario desactive su propia
                cuenta ni que el motel se quede sin administradores activos.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Usuario inexistente)
    50422 -> Unprocessable Entity      (Cuenta propia o último administrador)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspSetUserActive] (
    @TenantId     UNIQUEIDENTIFIER,
    @UserId       INT,
    @IsActive     BIT,
    @CurrentUserId INT = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL OR @UserId IS NULL OR @UserId <= 0
        THROW 50400, N'El usuario no es válido.', 1;

    DECLARE @Role NVARCHAR(50);

    SELECT @Role = u.Role
    FROM [Security].[User] AS u
    WHERE u.TenantId = @TenantId
      AND u.UserId = @UserId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El usuario no existe en este motel.', 1;

    IF @IsActive = 0 AND @CurrentUserId IS NOT NULL AND @UserId = @CurrentUserId
        THROW 50422, N'No puedes desactivar tu propia cuenta.', 1;

    IF @IsActive = 0
       AND UPPER(LTRIM(RTRIM(@Role))) = N'ADMIN'
       AND (SELECT COUNT(*) FROM [Security].[User] AS u
            WHERE u.TenantId = @TenantId
              AND u.IsActive = 1
              AND UPPER(LTRIM(RTRIM(u.Role))) = N'ADMIN') <= 1
        THROW 50422, N'Debe quedar al menos un administrador activo en el motel.', 1;

    UPDATE [Security].[User]
    SET IsActive = @IsActive
    WHERE TenantId = @TenantId
      AND UserId = @UserId;
END
GO
