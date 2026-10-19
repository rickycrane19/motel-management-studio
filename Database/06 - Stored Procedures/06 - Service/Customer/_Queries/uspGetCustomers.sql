/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetCustomers]
   SUBDOMAIN:   Customer
   DESCRIPTION: Listado PAGINADO de clientes registrados (no anónimos). Devuelve SOLO la
                página pedida y, en @TotalRecords (OUTPUT), el total de coincidencias para
                paginar en la UI. @Search busca por nombre, documento, teléfono o correo;
                @OnlyActive (NULL = ambos) filtra por estado. Las tarjetas de resumen se
                alimentan con @TotalCount / @ActiveCount / @ContactCount (clientes con
                teléfono o correo).
   ══════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetCustomers] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @OnlyActive   BIT           = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @TotalRecords INT           = NULL OUTPUT,
    @TotalCount   INT           = NULL OUTPUT,
    @ActiveCount  INT           = NULL OUTPUT,
    @ContactCount INT           = NULL OUTPUT
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
        FROM [Service].[Customer] AS c
        WHERE c.TenantId = @TenantId
          AND c.IsAnonymous = 0
          AND (@OnlyActive IS NULL OR c.IsActive = @OnlyActive)
          AND (@Search IS NULL
               OR c.FullName LIKE '%' + @Search + '%'
               OR c.DocumentNumber LIKE '%' + @Search + '%'
               OR c.Phone LIKE '%' + @Search + '%'
               OR c.Email LIKE '%' + @Search + '%')
    );

    SET @TotalCount = (
        SELECT COUNT(*) FROM [Service].[Customer] AS c
        WHERE c.TenantId = @TenantId AND c.IsAnonymous = 0);

    SET @ActiveCount = (
        SELECT COUNT(*) FROM [Service].[Customer] AS c
        WHERE c.TenantId = @TenantId AND c.IsAnonymous = 0 AND c.IsActive = 1);

    SET @ContactCount = (
        SELECT COUNT(*) FROM [Service].[Customer] AS c
        WHERE c.TenantId = @TenantId AND c.IsAnonymous = 0
          AND (NULLIF(LTRIM(RTRIM(c.Phone)), '') IS NOT NULL
               OR NULLIF(LTRIM(RTRIM(c.Email)), '') IS NOT NULL));

    SELECT
        c.CustomerId,
        c.FullName,
        c.DocumentNumber,
        c.Phone,
        c.Email,
        c.Notes,
        c.IsActive,
        c.CreatedOn
    FROM [Service].[Customer] AS c
    WHERE c.TenantId = @TenantId
      AND c.IsAnonymous = 0
      AND (@OnlyActive IS NULL OR c.IsActive = @OnlyActive)
      AND (@Search IS NULL
           OR c.FullName LIKE '%' + @Search + '%'
           OR c.DocumentNumber LIKE '%' + @Search + '%'
           OR c.Phone LIKE '%' + @Search + '%'
           OR c.Email LIKE '%' + @Search + '%')
    ORDER BY c.FullName, c.CustomerId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
