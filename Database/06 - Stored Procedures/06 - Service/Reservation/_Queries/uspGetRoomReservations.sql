/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetRoomReservations]
   SUBDOMAIN:   Reservation
   DESCRIPTION: Listado PAGINADO de reservaciones de habitaciones con proyección de hora local
                Managua. Devuelve SOLO la página pedida y, en @TotalRecords (OUTPUT), el total de
                coincidencias para paginar en la UI. Filtra por rango de inicio [@FromUtc, @ToUtc),
                por estado @Status (NULL = todos) y por @Search (cliente, teléfono o habitación).
   ═══════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetRoomReservations] (
    @TenantId     UNIQUEIDENTIFIER,
    @Search       NVARCHAR(150) = NULL,
    @Status       TINYINT       = NULL,
    @FromUtc      DATETIME2     = NULL,
    @ToUtc        DATETIME2     = NULL,
    @Page         INT           = 1,
    @PageSize     INT           = 20,
    @TotalRecords INT           = NULL OUTPUT,
    @ConfirmedCount INT         = NULL OUTPUT,
    @TodayCount     INT         = NULL OUTPUT,
    @CancelledCount INT         = NULL OUTPUT,
    @NoShowCount    INT         = NULL OUTPUT
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
        FROM [Service].[RoomReservation] AS res
        INNER JOIN [Service].[Room] AS r ON res.RoomId = r.RoomId
        WHERE res.TenantId = @TenantId
          AND (@Status IS NULL OR res.[Status] = @Status)
          AND (@FromUtc IS NULL OR res.ReservationStartUtc >= @FromUtc)
          AND (@ToUtc IS NULL OR res.ReservationStartUtc < @ToUtc)
          AND (@Search IS NULL
               OR res.CustomerName LIKE '%' + @Search + '%'
               OR res.Phone LIKE '%' + @Search + '%'
               OR r.RoomNumber LIKE '%' + @Search + '%')
    );

    -- Contadores globales del tenant para las tarjetas del listado.
    SET @ConfirmedCount = (
        SELECT COUNT(*) FROM [Service].[RoomReservation] AS res
        WHERE res.TenantId = @TenantId AND res.[Status] = 1);

    SET @TodayCount = (
        SELECT COUNT(*) FROM [Service].[RoomReservation] AS res
        WHERE res.TenantId = @TenantId
          AND res.[Status] = 1
          AND CAST([Configuration].[fnToManaguaTime](res.ReservationStartUtc) AS DATE)
              = CAST([Configuration].[fnToManaguaTime](SYSUTCDATETIME()) AS DATE));

    SET @CancelledCount = (
        SELECT COUNT(*) FROM [Service].[RoomReservation] AS res
        WHERE res.TenantId = @TenantId AND res.[Status] = 3);

    SET @NoShowCount = (
        SELECT COUNT(*) FROM [Service].[RoomReservation] AS res
        WHERE res.TenantId = @TenantId AND res.[Status] = 4);

    SELECT
        res.ReservationId,
        res.RoomId,
        r.RoomNumber,
        rt.Name AS RoomTypeName,
        res.CustomerName,
        res.Phone,
        res.ServiceStayTypeId,
        st.Name AS ServiceStayTypeName,
        res.ReservationStartUtc,
        res.ReservationEndUtc,
        [Configuration].[fnToManaguaTime](res.ReservationStartUtc) AS ReservationStartManagua,
        [Configuration].[fnToManaguaTime](res.ReservationEndUtc) AS ReservationEndManagua,
        res.DepositAmount,
        res.[Status] AS StatusCode,
        CASE res.[Status]
            WHEN 1 THEN N'Confirmada'
            WHEN 2 THEN N'Check-In'
            WHEN 3 THEN N'Cancelada'
            WHEN 4 THEN N'No Show'
            ELSE N'Desconocido'
        END AS StatusName,
        res.Notes
    FROM [Service].[RoomReservation] AS res
    INNER JOIN [Service].[Room] AS r ON res.RoomId = r.RoomId
    INNER JOIN [Service].[RoomType] AS rt ON r.RoomTypeId = rt.RoomTypeId
    LEFT JOIN [Service].[ServiceStayType] AS st ON res.ServiceStayTypeId = st.ServiceStayTypeId
    WHERE res.TenantId = @TenantId
      AND (@Status IS NULL OR res.[Status] = @Status)
      AND (@FromUtc IS NULL OR res.ReservationStartUtc >= @FromUtc)
      AND (@ToUtc IS NULL OR res.ReservationStartUtc < @ToUtc)
      AND (@Search IS NULL
           OR res.CustomerName LIKE '%' + @Search + '%'
           OR res.Phone LIKE '%' + @Search + '%'
           OR r.RoomNumber LIKE '%' + @Search + '%')
    ORDER BY res.ReservationStartUtc DESC, res.ReservationId DESC
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
GO
