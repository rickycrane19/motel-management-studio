/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetFineTypes]
   SUBDOMAIN:   FineType
   DESCRIPTION: Listado PAGINADO del catálogo de tipos de multa (daños, objetos faltantes, etc.)
                del tenant. Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el total
                de coincidencias. @Search busca por nombre o descripción; @OnlyActive (NULL = ambos)
                filtra por estado. Las tarjetas de resumen se alimentan con @TotalCount /
                @ActiveCount / @InactiveCount / @AverageAmount. Los comboboxes siguen funcionando
                con @OnlyActive = 1 y @PageSize = 200.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetFineTypes] (
    @TenantId      UNIQUEIDENTIFIER,
    @Search        NVARCHAR(150) = NULL,
    @OnlyActive    BIT           = NULL,
    @Page          INT           = 1,
    @PageSize      INT           = 20,
    @TotalRecords  INT           = NULL OUTPUT,
    @TotalCount    INT           = NULL OUTPUT,
    @ActiveCount   INT           = NULL OUTPUT,
    @InactiveCount INT           = NULL OUTPUT,
    @AverageAmount DECIMAL(18,4) = NULL OUTPUT
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
        FROM [Service].[FineType] AS ft
        WHERE ft.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR ft.IsActive = @OnlyActive)
          AND (@Search IS NULL
               OR ft.Name LIKE '%' + @Search + '%'
               OR ft.Description LIKE '%' + @Search + '%')
    );

    -- Contadores del tenant para las tarjetas de resumen.
    SELECT
        @TotalCount    = ISNULL(SUM(1), 0),
        @ActiveCount   = ISNULL(SUM(CASE WHEN ft.IsActive = 1 THEN 1 ELSE 0 END), 0),
        @InactiveCount = ISNULL(SUM(CASE WHEN ft.IsActive = 0 THEN 1 ELSE 0 END), 0),
        @AverageAmount = ISNULL(AVG(ft.DefaultAmount), 0)
    FROM [Service].[FineType] AS ft
    WHERE ft.TenantId = @TenantId;

    SELECT
        ft.FineTypeId,
        ft.TenantId,
        ft.Name,
        ft.Description,
        ft.DefaultAmount,
        ft.IsActive,
        ft.CreatedOn
    FROM [Service].[FineType] AS ft
    WHERE ft.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR ft.IsActive = @OnlyActive)
      AND (@Search IS NULL
           OR ft.Name LIKE '%' + @Search + '%'
           OR ft.Description LIKE '%' + @Search + '%')
    ORDER BY ft.Name, ft.FineTypeId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
