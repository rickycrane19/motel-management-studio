/* ════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - SERVICE MODULE ]

   PROCEDURE:   [Service].[uspGetRoomStayDetail]
   SUBDOMAIN:   RoomStay
   DESCRIPTION: Devuelve el detalle de una estancia de habitación incluyendo el desglose
                de servicios, consumos de minibar y extensiones para estado de cuenta.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Service].[uspGetRoomStayDetail] (
    @TenantId   UNIQUEIDENTIFIER,
    @RoomStayId INT
)
AS
BEGIN
    SET NOCOUNT ON;

    -- Result set 1: Cabecera de la estancia
    SELECT
        s.RoomStayId,
        s.RoomId,
        r.RoomNumber,
        rt.Name AS RoomTypeName,
        s.CustomerId,
        s.CustomerName,
        s.ArrivalType,
        CASE s.ArrivalType WHEN 1 THEN N'A pie' WHEN 2 THEN N'En vehículo' ELSE N'N/A' END AS ArrivalTypeName,
        s.VehiclePlate,
        s.ServiceStayTypeId,
        st.Name AS ServiceStayTypeName,
        s.BaseServiceCost,
        s.StartTimeUtc,
        s.ExpectedEndTimeUtc,
        s.ActualEndTimeUtc,
        [Configuration].[fnToManaguaTime](s.StartTimeUtc) AS StartTimeManagua,
        [Configuration].[fnToManaguaTime](s.ExpectedEndTimeUtc) AS ExpectedEndTimeManagua,
        s.[Status] AS StatusCode,
        s.ExtendedHours,
        s.ExtensionCost,
        s.ProductsTotal,
        s.FinesTotal,
        s.TotalAmount,
        s.PaidAmount,
        s.IsPaid,
        s.PaymentMethod,
        s.Notes
    FROM [Service].[RoomStay] AS s
    INNER JOIN [Service].[Room] AS r ON s.RoomId = r.RoomId
    INNER JOIN [Service].[RoomType] AS rt ON r.RoomTypeId = rt.RoomTypeId
    LEFT JOIN [Service].[ServiceStayType] AS st ON s.ServiceStayTypeId = st.ServiceStayTypeId
    WHERE s.RoomStayId = @RoomStayId AND s.TenantId = @TenantId;

    -- Result set 2: Lista de consumos en minibar
    SELECT
        c.ConsumptionId,
        c.ProductId,
        p.Name AS ProductName,
        p.Code AS ProductCode,
        c.Quantity,
        c.UnitPrice,
        c.SubTotal,
        c.CreatedOnUtc,
        [Configuration].[fnToManaguaTime](c.CreatedOnUtc) AS CreatedOnManagua
    FROM [Service].[RoomStayConsumption] AS c
    INNER JOIN [Inventory].[Product] AS p ON c.ProductId = p.ProductId
    WHERE c.RoomStayId = @RoomStayId AND c.TenantId = @TenantId
    ORDER BY c.CreatedOnUtc;

    -- Result set 3: Lista de extensiones de tiempo
    SELECT
        e.ExtensionId,
        e.ServiceStayTypeId,
        st.Name AS ServiceStayTypeName,
        e.ExtraHours,
        e.Cost,
        e.NewExpectedEndTimeUtc,
        [Configuration].[fnToManaguaTime](e.NewExpectedEndTimeUtc) AS NewExpectedEndTimeManagua,
        e.CreatedOnUtc
    FROM [Service].[RoomStayExtension] AS e
    INNER JOIN [Service].[ServiceStayType] AS st ON e.ServiceStayTypeId = st.ServiceStayTypeId
    WHERE e.RoomStayId = @RoomStayId AND e.TenantId = @TenantId
    ORDER BY e.CreatedOnUtc;

    -- Result set 4: Lista de multas / cargos por daños
    SELECT
        f.FineId,
        f.FineTypeId,
        ft.Name AS FineTypeName,
        f.Description,
        f.Amount,
        f.CurrencyCode,
        f.AmountInBase,
        f.IsWaived,
        f.WaivedReason,
        [Configuration].[fnToManaguaTime](f.RecordedAtUtc) AS RecordedAtManagua
    FROM [Service].[RoomStayFine] AS f
    LEFT JOIN [Service].[FineType] AS ft ON f.FineTypeId = ft.FineTypeId
    WHERE f.RoomStayId = @RoomStayId AND f.TenantId = @TenantId
    ORDER BY f.RecordedAtUtc;
END
GO
