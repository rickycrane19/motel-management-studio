/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspUpdateUser]
   SUBDOMAIN:   User
   DESCRIPTION: Actualiza usuario, correo, nombre, perfil y (opcionalmente) la contraseña.
                @PasswordHash NULL conserva la contraseña actual. Evita duplicados de usuario
                y correo dentro del tenant y no permite quedarse sin administradores activos.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50404 -> Not Found                 (Usuario inexistente)
    50409 -> Conflict                  (Usuario o correo duplicado)
    50422 -> Unprocessable Entity      (Se quedaría sin administrador activo)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspUpdateUser] (
    @TenantId     UNIQUEIDENTIFIER,
    @UserId       INT,
    @Username     NVARCHAR(100),
    @Email        NVARCHAR(150),
    @FullName     NVARCHAR(150),
    @Role         NVARCHAR(50),
    @PasswordHash NVARCHAR(400) = NULL
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL OR @UserId IS NULL OR @UserId <= 0
        THROW 50400, N'El usuario a actualizar no es válido.', 1;

    IF NULLIF(LTRIM(RTRIM(@Username)), '') IS NULL
        THROW 50400, N'El nombre de usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
        THROW 50400, N'El correo del usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre completo del usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Role)), '') IS NULL
        THROW 50400, N'El perfil del usuario es obligatorio.', 1;

    DECLARE @CurrentRole NVARCHAR(50);

    SELECT @CurrentRole = u.Role
    FROM [Security].[User] AS u
    WHERE u.TenantId = @TenantId
      AND u.UserId = @UserId;

    IF @@ROWCOUNT = 0
        THROW 50404, N'El usuario no existe en este motel.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND u.UserId <> @UserId
          AND UPPER(LTRIM(RTRIM(u.Username))) = UPPER(LTRIM(RTRIM(@Username)))
    )
        THROW 50409, N'Ya existe otro usuario con ese nombre de usuario en este motel.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND u.UserId <> @UserId
          AND UPPER(LTRIM(RTRIM(u.Email))) = UPPER(LTRIM(RTRIM(@Email)))
    )
        THROW 50409, N'Ya existe otro usuario con ese correo en este motel.', 1;

    -- Si deja de ser administrador, debe quedar al menos otro administrador activo.
    IF UPPER(LTRIM(RTRIM(@CurrentRole))) = N'ADMIN'
       AND UPPER(LTRIM(RTRIM(@Role))) <> N'ADMIN'
       AND (SELECT COUNT(*) FROM [Security].[User] AS u
            WHERE u.TenantId = @TenantId
              AND u.IsActive = 1
              AND UPPER(LTRIM(RTRIM(u.Role))) = N'ADMIN') <= 1
        THROW 50422, N'Debe quedar al menos un administrador activo en el motel.', 1;

    UPDATE [Security].[User]
    SET Username     = LTRIM(RTRIM(@Username)),
        Email        = LTRIM(RTRIM(@Email)),
        FullName     = LTRIM(RTRIM(@FullName)),
        Role         = LTRIM(RTRIM(@Role)),
        PasswordHash = COALESCE(NULLIF(LTRIM(RTRIM(@PasswordHash)), ''), PasswordHash)
    WHERE TenantId = @TenantId
      AND UserId = @UserId;
END
GO
