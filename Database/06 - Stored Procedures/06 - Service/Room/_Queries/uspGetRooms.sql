/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetRooms]
   SUBDOMAIN:   Room
   DESCRIPTION: Listado PAGINADO de habitaciones del motel con su estado físico, tipo y datos
                de la estancia activa si está ocupada (minutos restantes y alerta). El total
                filtrado viaja en @TotalRecords (OUTPUT) y las tarjetas de resumen en los
                contadores @ActiveCount / @InactiveCount / @AvailableCount / @OccupiedCount.

                @IncludeInactive = 1 -> incluye las habitaciones desactivadas (backoffice);
                por defecto solo las activas (POS / monitor). @OnlyActive filtra por estado
                (NULL = ambos). @Search busca por número, tipo o notas; @RoomTypeId, @FloorNumber
                y @StatusCode acotan por tipo, piso y estado físico respectivamente.
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetRooms] (
    @TenantId        UNIQUEIDENTIFIER,
    @Search          NVARCHAR(150) = NULL,
    @OnlyActive      BIT           = NULL,
    @IncludeInactive BIT           = 0,
    @RoomTypeId      INT           = NULL,
    @FloorNumber     INT           = NULL,
    @StatusCode      TINYINT       = NULL,
    @Page            INT           = 1,
    @PageSize        INT           = 20,
    @TotalRecords    INT           = NULL OUTPUT,
    @ActiveCount     INT           = NULL OUTPUT,
    @InactiveCount   INT           = NULL OUTPUT,
    @AvailableCount  INT           = NULL OUTPUT,
    @OccupiedCount   INT           = NULL OUTPUT
)
AS
BEGIN
    SET NOCOUNT ON;

    SET @IncludeInactive = ISNULL(@IncludeInactive, 0);
    SET @Search = NULLIF(LTRIM(RTRIM(@Search)), '');

    SET @Page = CASE WHEN @Page < 1 THEN 1 ELSE @Page END;
    SET @PageSize = CASE WHEN @PageSize < 1 THEN 20 WHEN @PageSize > 200 THEN 200 ELSE @PageSize END;

    SET @TotalRecords =
    (
        SELECT COUNT(*)
        FROM [Service].[Room] AS r
        INNER JOIN [Service].[RoomType] AS rt ON r.RoomTypeId = rt.RoomTypeId
        WHERE r.TenantId = @TenantId
          AND (@IncludeInactive = 1 OR r.IsActive = 1)
          AND (@OnlyActive IS NULL OR r.IsActive = @OnlyActive)
          AND (@RoomTypeId IS NULL OR r.RoomTypeId = @RoomTypeId)
          AND (@FloorNumber IS NULL OR r.FloorNumber = @FloorNumber)
          AND (@StatusCode IS NULL OR r.[Status] = @StatusCode)
          AND (@Search IS NULL
               OR r.RoomNumber LIKE '%' + @Search + '%'
               OR rt.Name LIKE '%' + @Search + '%'
               OR r.Notes LIKE '%' + @Search + '%')
    );

    -- Contadores del tenant para las tarjetas de resumen (no dependen de los filtros de la página).
    SELECT
        @ActiveCount    = ISNULL(SUM(CASE WHEN r.IsActive = 1 THEN 1 ELSE 0 END), 0),
        @InactiveCount  = ISNULL(SUM(CASE WHEN r.IsActive = 0 THEN 1 ELSE 0 END), 0),
        @AvailableCount = ISNULL(SUM(CASE WHEN r.IsActive = 1 AND r.[Status] = 0 THEN 1 ELSE 0 END), 0),
        @OccupiedCount  = ISNULL(SUM(CASE WHEN r.IsActive = 1 AND r.[Status] = 1 THEN 1 ELSE 0 END), 0)
    FROM [Service].[Room] AS r
    WHERE r.TenantId = @TenantId;

    SELECT
        r.RoomId,
        r.TenantId,
        r.LocationId,
        r.RoomNumber,
        r.RoomTypeId,
        rt.Name AS RoomTypeName,
        rt.HasGarage,
        rt.HasJacuzzi,
        rt.Capacity,
        r.[Status] AS StatusCode,
        CASE r.[Status]
            WHEN 0 THEN N'Disponible'
            WHEN 1 THEN N'Ocupado'
            WHEN 2 THEN N'Limpieza'
            WHEN 3 THEN N'Mantenimiento'
            WHEN 4 THEN N'Reservado'
            ELSE N'Desconocido'
        END AS StatusName,
        r.FloorNumber,
        r.Notes,
        r.IsActive,
        r.ImageUrl,
        r.CurrentRoomStayId,
        s.CustomerId,
        s.CustomerName,
        s.ArrivalType,
        CASE s.ArrivalType
            WHEN 1 THEN N'A pie'
            WHEN 2 THEN N'En vehículo'
            ELSE N'N/A'
        END AS ArrivalTypeName,
        s.VehiclePlate,
        s.ServiceStayTypeId,
        st.Name AS ServiceStayTypeName,
        s.BaseServiceCost,
        s.StartTimeUtc,
        s.ExpectedEndTimeUtc,
        s.ExtendedHours,
        s.ExtensionCost,
        s.ProductsTotal,
        s.FinesTotal,
        s.TotalAmount,
        [Configuration].[fnToManaguaTime](s.StartTimeUtc) AS StartTimeManagua,
        [Configuration].[fnToManaguaTime](s.ExpectedEndTimeUtc) AS ExpectedEndTimeManagua,
        DATEDIFF(MINUTE, s.StartTimeUtc, SYSUTCDATETIME()) AS ElapsedMinutes,
        DATEDIFF(MINUTE, SYSUTCDATETIME(), s.ExpectedEndTimeUtc) AS RemainingMinutes,
        CASE 
            WHEN s.RoomStayId IS NOT NULL AND DATEDIFF(MINUTE, SYSUTCDATETIME(), s.ExpectedEndTimeUtc) <= 10 THEN 1 
            ELSE 0 
        END AS IsExpiringSoon
    FROM [Service].[Room] AS r
    INNER JOIN [Service].[RoomType] AS rt ON r.RoomTypeId = rt.RoomTypeId
    LEFT JOIN [Service].[RoomStay] AS s ON r.CurrentRoomStayId = s.RoomStayId AND s.[Status] = 1
    LEFT JOIN [Service].[ServiceStayType] AS st ON s.ServiceStayTypeId = st.ServiceStayTypeId
    WHERE r.TenantId = @TenantId
      AND (@IncludeInactive = 1 OR r.IsActive = 1)
      AND (@OnlyActive IS NULL OR r.IsActive = @OnlyActive)
      AND (@RoomTypeId IS NULL OR r.RoomTypeId = @RoomTypeId)
      AND (@FloorNumber IS NULL OR r.FloorNumber = @FloorNumber)
      AND (@StatusCode IS NULL OR r.[Status] = @StatusCode)
      AND (@Search IS NULL
           OR r.RoomNumber LIKE '%' + @Search + '%'
           OR rt.Name LIKE '%' + @Search + '%'
           OR r.Notes LIKE '%' + @Search + '%')
    ORDER BY r.FloorNumber, r.RoomNumber, r.RoomId
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
