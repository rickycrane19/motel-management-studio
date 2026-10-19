/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspInsertUser]
   SUBDOMAIN:   User
   DESCRIPTION: Registra un usuario del sistema para el tenant. El hash de la contraseña lo
                calcula la capa de aplicación (PBKDF2); aquí solo se persiste. Valida que el
                nombre de usuario y el correo no estén repetidos dentro del tenant.

   [ DICCIONARIO DE ERRORES LANZADOS MANUALMENTE VIA THROW ]

    50400 -> Bad Request               (Parámetros inválidos)
    50409 -> Conflict                  (Usuario o correo duplicado)
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspInsertUser] (
    @TenantId     UNIQUEIDENTIFIER,
    @LocationId   UNIQUEIDENTIFIER = NULL,
    @Username     NVARCHAR(100),
    @Email        NVARCHAR(150),
    @PasswordHash NVARCHAR(400),
    @FullName     NVARCHAR(150),
    @Role         NVARCHAR(50) = N'Receptionist',
    @InsertedId   INT = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    IF @TenantId IS NULL
        THROW 50400, N'El TenantId es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Username)), '') IS NULL
        THROW 50400, N'El nombre de usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Email)), '') IS NULL
        THROW 50400, N'El correo del usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@PasswordHash)), '') IS NULL
        THROW 50400, N'La contraseña del usuario es obligatoria.', 1;

    IF NULLIF(LTRIM(RTRIM(@FullName)), '') IS NULL
        THROW 50400, N'El nombre completo del usuario es obligatorio.', 1;

    IF NULLIF(LTRIM(RTRIM(@Role)), '') IS NULL
        THROW 50400, N'El perfil del usuario es obligatorio.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND UPPER(LTRIM(RTRIM(u.Username))) = UPPER(LTRIM(RTRIM(@Username)))
    )
        THROW 50409, N'Ya existe un usuario con ese nombre de usuario en este motel.', 1;

    IF EXISTS (
        SELECT 1
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND UPPER(LTRIM(RTRIM(u.Email))) = UPPER(LTRIM(RTRIM(@Email)))
    )
        THROW 50409, N'Ya existe un usuario con ese correo en este motel.', 1;

    INSERT INTO [Security].[User]
    (
        TenantId,
        LocationId,
        Username,
        Email,
        PasswordHash,
        FullName,
        Role,
        IsActive,
        CreatedOn
    )
    VALUES
    (
        @TenantId,
        @LocationId,
        LTRIM(RTRIM(@Username)),
        LTRIM(RTRIM(@Email)),
        @PasswordHash,
        LTRIM(RTRIM(@FullName)),
        LTRIM(RTRIM(@Role)),
        1,
        SYSUTCDATETIME()
    );

    SET @InsertedId = SCOPE_IDENTITY();
END
GO
