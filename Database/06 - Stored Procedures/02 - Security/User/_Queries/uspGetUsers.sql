/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SECURITY MODULE ]

   PROCEDURE:   [Security].[uspGetUsers]
   SUBDOMAIN:   User
   DESCRIPTION: Listado PAGINADO de usuarios del sistema para el tenant. Devuelve SOLO la página
                pedida y, en @TotalRecords (OUTPUT), el total de coincidencias para paginar en la
                UI. @Search busca por usuario, nombre o correo; @OnlyActive (NULL = ambos) filtra
                por estado. Las tarjetas de resumen se alimentan con @TotalCount / @ActiveCount /
                @RoleCount (roles distintos en uso).
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Security].[uspGetUsers] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @OnlyActive   BIT           = NULL,
    @Role         NVARCHAR(50)  = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @TotalRecords INT           = NULL OUTPUT,
    @TotalCount   INT           = NULL OUTPUT,
    @ActiveCount  INT           = NULL OUTPUT,
    @RoleCount    INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Security].[User] AS u
        WHERE u.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR u.IsActive = @OnlyActive)
          AND (@Role IS NULL OR UPPER(LTRIM(RTRIM(u.Role))) = UPPER(LTRIM(RTRIM(@Role))))
          AND (@Search IS NULL
               OR u.Username LIKE '%' + @Search + '%'
               OR u.FullName LIKE '%' + @Search + '%'
               OR u.Email LIKE '%' + @Search + '%')
    );

    -- Contadores del tenant para las tarjetas de resumen.
    SELECT
        @TotalCount  = ISNULL(SUM(1), 0),
        @ActiveCount = ISNULL(SUM(CASE WHEN u.IsActive = 1 THEN 1 ELSE 0 END), 0),
        @RoleCount   = COUNT(DISTINCT UPPER(LTRIM(RTRIM(u.Role))))
    FROM [Security].[User] AS u
    WHERE u.TenantId = @TenantId;

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
      AND (@OnlyActive IS NULL OR u.IsActive = @OnlyActive)
      AND (@Role IS NULL OR UPPER(LTRIM(RTRIM(u.Role))) = UPPER(LTRIM(RTRIM(@Role))))
      AND (@Search IS NULL
           OR u.Username LIKE '%' + @Search + '%'
           OR u.FullName LIKE '%' + @Search + '%'
           OR u.Email LIKE '%' + @Search + '%')
    ORDER BY u.FullName, u.UserId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
