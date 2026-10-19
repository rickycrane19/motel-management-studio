/* ══════════════════════════════════════════════════════════════════════════════════════════════
   [ MOTELMS - FINANCE MODULE ]

   PROCEDURE:   [Finance].[uspGetServiceSalesReport]
   SUBDOMAIN:   Reports
   DESCRIPTION: Ventas de servicios (estancias cerradas/cobradas en el período): cortes por
                tipo de tarifa (ServiceStayType) y por tipo de llegada (a pie / en vehículo),
                con horas promedio por estancia y cobro promedio. El desglose por la intersección
                (tarifa × llegada) permite agrupar cualquiera de las dos dimensiones en UI.
   ════════════════════════════════════════════════════════════════════════════════════════════ */
USE MotelMSDB
GO

CREATE OR ALTER PROC [Finance].[uspGetServiceSalesReport] (
    @TenantId UNIQUEIDENTIFIER,
    @FromUtc  DATETIME2,
    @ToUtc    DATETIME2
)
AS
BEGIN
    SET NOCOUNT ON;

    WITH FinesPerStay AS
    (
        SELECT f.RoomStayId, SUM(f.AmountInBase) AS FinesInBase
        FROM [Service].[RoomStayFine] AS f
        WHERE f.IsWaived = 0
        GROUP BY f.RoomStayId
    )
    SELECT
        st.ServiceStayTypeId,
        st.Name AS StayTypeName,
        rs.ArrivalType,
        CASE rs.ArrivalType WHEN 1 THEN N'A pie' WHEN 2 THEN N'En vehículo' ELSE N'Tipo ' + CAST(rs.ArrivalType AS NVARCHAR(10)) END AS ArrivalName,
        COUNT(*) AS Stays,
        SUM(ISNULL(rs.BaseServiceCost, 0)) AS BaseRevenue,
        SUM(ISNULL(rs.ExtensionCost, 0)) AS ExtensionRevenue,
        SUM(ISNULL(rs.ProductsTotal, 0)) AS ProductsRevenue,
        SUM(ISNULL(fi.FinesInBase, 0)) AS FinesRevenue,
        SUM(ISNULL(rs.TotalAmount, 0)) AS TotalRevenue,
        AVG(rs.TotalAmount) AS AvgStayTotal,
        AVG(DATEDIFF(MINUTE, rs.StartTimeUtc, rs.ActualEndTimeUtc) / 60.0) AS AvgHours
    FROM [Service].[RoomStay] AS rs
    INNER JOIN [Service].[ServiceStayType] AS st ON st.ServiceStayTypeId = rs.ServiceStayTypeId
    LEFT JOIN FinesPerStay AS fi ON fi.RoomStayId = rs.RoomStayId
    WHERE rs.TenantId = @TenantId
      AND rs.[Status] = 2
      AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) >= @FromUtc
      AND COALESCE(rs.ActualEndTimeUtc, rs.CreatedOnUtc) < @ToUtc
    GROUP BY st.ServiceStayTypeId, st.Name, rs.ArrivalType
    ORDER BY st.Name, rs.ArrivalType;
END
GO
