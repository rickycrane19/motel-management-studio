/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetServiceStayTypes]
   SUBDOMAIN:   ServiceStayType
   DESCRIPTION: Listado PAGINADO de tipos de servicio de estancia y extensiones con sus precios.
                Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el total de
                coincidencias. @Search busca por nombre de tarifa o tipo de cuarto; @OnlyActive
                (NULL = ambos) filtra por estado y @IsExtension (NULL = ambos) por permanencia
                o extensión. Las tarjetas de resumen se alimentan con los contadores
                @TotalCount / @ActiveCount / @InactiveCount / @ExtensionCount.
                Los comboboxes siguen funcionando con @OnlyActive = 1 y @PageSize = 200.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetServiceStayTypes] (
    @TenantId       UNIQUEIDENTIFIER,
    @Search         NVARCHAR(150) = NULL,
    @OnlyActive     BIT           = NULL,
    @IsExtension    BIT           = NULL,
    @Page           INT           = 1,
    @PageSize       INT           = 20,
    @TotalRecords   INT           = NULL OUTPUT,
    @TotalCount     INT           = NULL OUTPUT,
    @ActiveCount    INT           = NULL OUTPUT,
    @InactiveCount  INT           = NULL OUTPUT,
    @ExtensionCount INT           = NULL OUTPUT
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
        FROM [Service].[ServiceStayType] AS st
        LEFT JOIN [Service].[RoomType] AS rt ON st.RoomTypeId = rt.RoomTypeId
        WHERE st.TenantId = @TenantId
          AND (@OnlyActive IS NULL OR st.IsActive = @OnlyActive)
          AND (@IsExtension IS NULL OR st.IsExtension = @IsExtension)
          AND (@Search IS NULL
               OR st.Name LIKE '%' + @Search + '%'
               OR rt.Name LIKE '%' + @Search + '%')
    );

    -- Contadores del tenant para las tarjetas de resumen.
    SELECT
        @TotalCount     = ISNULL(SUM(1), 0),
        @ActiveCount    = ISNULL(SUM(CASE WHEN st.IsActive = 1 THEN 1 ELSE 0 END), 0),
        @InactiveCount  = ISNULL(SUM(CASE WHEN st.IsActive = 0 THEN 1 ELSE 0 END), 0),
        @ExtensionCount = ISNULL(SUM(CASE WHEN st.IsExtension = 1 THEN 1 ELSE 0 END), 0)
    FROM [Service].[ServiceStayType] AS st
    WHERE st.TenantId = @TenantId;

    SELECT
        st.ServiceStayTypeId,
        st.RoomTypeId,
        rt.Name AS RoomTypeName,
        st.Name,
        st.DurationHours,
        st.Price,
        st.IsExtension,
        st.IsActive
    FROM [Service].[ServiceStayType] AS st
    LEFT JOIN [Service].[RoomType] AS rt ON st.RoomTypeId = rt.RoomTypeId
    WHERE st.TenantId = @TenantId
      AND (@OnlyActive IS NULL OR st.IsActive = @OnlyActive)
      AND (@IsExtension IS NULL OR st.IsExtension = @IsExtension)
      AND (@Search IS NULL
           OR st.Name LIKE '%' + @Search + '%'
           OR rt.Name LIKE '%' + @Search + '%')
    ORDER BY st.IsExtension, st.DurationHours, st.ServiceStayTypeId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
