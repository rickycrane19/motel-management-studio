USE [MotelMSDB];
GO

IF OBJECT_ID(N'Service.RoomStayFine', 'U') IS NOT NULL DROP TABLE [Service].[RoomStayFine];
IF OBJECT_ID(N'Service.FineType', 'U') IS NOT NULL DROP TABLE [Service].[FineType];
IF OBJECT_ID(N'Service.RoomStayConsumption', 'U') IS NOT NULL DROP TABLE [Service].[RoomStayConsumption];
IF OBJECT_ID(N'Service.RoomStayExtension', 'U') IS NOT NULL DROP TABLE [Service].[RoomStayExtension];
IF OBJECT_ID(N'Service.RoomReservation', 'U') IS NOT NULL DROP TABLE [Service].[RoomReservation];
IF OBJECT_ID(N'Service.Room', 'U') IS NOT NULL DROP TABLE [Service].[Room];
IF OBJECT_ID(N'Service.RoomStay', 'U') IS NOT NULL DROP TABLE [Service].[RoomStay];
IF OBJECT_ID(N'Service.ServiceStayType', 'U') IS NOT NULL DROP TABLE [Service].[ServiceStayType];
IF OBJECT_ID(N'Service.RoomType', 'U') IS NOT NULL DROP TABLE [Service].[RoomType];
IF OBJECT_ID(N'Service.Customer', 'U') IS NOT NULL DROP TABLE [Service].[Customer];
GO

CREATE TABLE [Service].[Customer]
(
    CustomerId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    FullName        NVARCHAR(150)     NOT NULL,
    DocumentNumber  NVARCHAR(50)      NULL,
    Phone           NVARCHAR(50)      NULL,
    Email           NVARCHAR(150)     NULL,
    Notes           NVARCHAR(300)     NULL,
    IsAnonymous     BIT               NOT NULL CONSTRAINT DF_Customer_IsAnonymous DEFAULT 0,
    IsActive        BIT               NOT NULL CONSTRAINT DF_Customer_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Customer_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Customer PRIMARY KEY CLUSTERED (CustomerId),
    CONSTRAINT FK_Customer_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO

CREATE TABLE [Service].[RoomType]
(
    RoomTypeId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    Name            NVARCHAR(100)     NOT NULL,
    Description     NVARCHAR(500)     NULL,
    BasePrice       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomType_BasePrice DEFAULT 0,
    HasGarage       BIT               NOT NULL CONSTRAINT DF_RoomType_HasGarage DEFAULT 1,
    HasJacuzzi      BIT               NOT NULL CONSTRAINT DF_RoomType_HasJacuzzi DEFAULT 0,
    Capacity        INT               NOT NULL CONSTRAINT DF_RoomType_Capacity DEFAULT 2,
    IsActive        BIT               NOT NULL CONSTRAINT DF_RoomType_IsActive DEFAULT 1,

    CONSTRAINT PK_RoomType PRIMARY KEY CLUSTERED (RoomTypeId),
    CONSTRAINT FK_RoomType_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO

CREATE TABLE [Service].[ServiceStayType]
(
    ServiceStayTypeId INT IDENTITY(1,1) NOT NULL,
    TenantId          UNIQUEIDENTIFIER  NOT NULL,
    RoomTypeId        INT               NULL,
    Name              NVARCHAR(100)     NOT NULL,
    DurationHours     DECIMAL(5,2)      NOT NULL CONSTRAINT DF_StayType_Hours DEFAULT 2.0,
    Price             DECIMAL(18,4)     NOT NULL CONSTRAINT DF_StayType_Price DEFAULT 0,
    IsExtension       BIT               NOT NULL CONSTRAINT DF_StayType_IsExt DEFAULT 0,
    IsActive          BIT               NOT NULL CONSTRAINT DF_StayType_IsActive DEFAULT 1,

    CONSTRAINT PK_ServiceStayType PRIMARY KEY CLUSTERED (ServiceStayTypeId),
    CONSTRAINT FK_ServiceStayType_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_ServiceStayType_RoomType FOREIGN KEY (RoomTypeId) REFERENCES [Service].[RoomType](RoomTypeId)
);
GO

CREATE TABLE [Service].[RoomStay]
(
    RoomStayId          INT IDENTITY(1,1) NOT NULL,
    TenantId            UNIQUEIDENTIFIER  NOT NULL,
    LocationId          UNIQUEIDENTIFIER  NULL,
    RoomId              INT               NOT NULL,
    CustomerId          INT               NULL,
    CustomerName        NVARCHAR(150)     NOT NULL CONSTRAINT DF_RoomStay_CustName DEFAULT 'Anónimo',
    ArrivalType         TINYINT           NOT NULL CONSTRAINT DF_RoomStay_Arrival DEFAULT 1, -- 1 = A pie, 2 = En vehículo
    VehiclePlate        NVARCHAR(30)      NULL, -- Número de placa o 'A pie'
    ServiceStayTypeId   INT               NOT NULL,
    BaseServiceCost     DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_BaseCost DEFAULT 0,
    StartTimeUtc        DATETIME2         NOT NULL CONSTRAINT DF_RoomStay_Start DEFAULT SYSUTCDATETIME(),
    ExpectedEndTimeUtc  DATETIME2         NOT NULL,
    ActualEndTimeUtc    DATETIME2         NULL,
    [Status]            TINYINT           NOT NULL CONSTRAINT DF_RoomStay_Status DEFAULT 1, -- 1 = Activo, 2 = Finalizado/Cobrado, 3 = Cancelado
    ExtendedHours       DECIMAL(5,2)      NOT NULL CONSTRAINT DF_RoomStay_ExtHours DEFAULT 0,
    ExtensionCost       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_ExtCost DEFAULT 0,
    ProductsTotal       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_ProdTotal DEFAULT 0,
    FinesTotal          DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_FinesTotal DEFAULT 0, -- Multas/cargos por daños acumulados
    TotalAmount         DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_Total DEFAULT 0,
    PaidAmount          DECIMAL(18,4)     NOT NULL CONSTRAINT DF_RoomStay_Paid DEFAULT 0,
    IsPaid              BIT               NOT NULL CONSTRAINT DF_RoomStay_IsPaid DEFAULT 0,
    PaymentMethod       NVARCHAR(50)      NULL, -- 'Efectivo NIO', 'Efectivo USD', 'Tarjeta', etc.
    CashBoxSessionId    INT               NULL,
    Notes               NVARCHAR(500)     NULL,
    CreatedBy           INT               NULL,
    CreatedOnUtc        DATETIME2         NOT NULL CONSTRAINT DF_RoomStay_Created DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RoomStay PRIMARY KEY CLUSTERED (RoomStayId),
    CONSTRAINT FK_RoomStay_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_RoomStay_Customer FOREIGN KEY (CustomerId) REFERENCES [Service].[Customer](CustomerId),
    CONSTRAINT FK_RoomStay_ServiceStayType FOREIGN KEY (ServiceStayTypeId) REFERENCES [Service].[ServiceStayType](ServiceStayTypeId)
);
GO

CREATE TABLE [Service].[Room]
(
    RoomId              INT IDENTITY(1,1) NOT NULL,
    TenantId            UNIQUEIDENTIFIER  NOT NULL,
    LocationId          UNIQUEIDENTIFIER  NULL,
    RoomNumber          NVARCHAR(20)      NOT NULL,
    RoomTypeId          INT               NOT NULL,
    [Status]            TINYINT           NOT NULL CONSTRAINT DF_Room_Status DEFAULT 0, -- 0 = Libre, 1 = Ocupado, 2 = Limpieza, 3 = Mantenimiento, 4 = Reservado
    CurrentRoomStayId   INT               NULL,
    FloorNumber         INT               NOT NULL CONSTRAINT DF_Room_Floor DEFAULT 1,
    Notes               NVARCHAR(200)     NULL,
    IsActive            BIT               NOT NULL CONSTRAINT DF_Room_IsActive DEFAULT 1,
    CreatedOn           DATETIME2         NOT NULL CONSTRAINT DF_Room_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Room PRIMARY KEY CLUSTERED (RoomId),
    CONSTRAINT FK_Room_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Room_RoomType FOREIGN KEY (RoomTypeId) REFERENCES [Service].[RoomType](RoomTypeId),
    CONSTRAINT FK_Room_CurrentStay FOREIGN KEY (CurrentRoomStayId) REFERENCES [Service].[RoomStay](RoomStayId)
);
GO

-- Añadir FK diferida desde RoomStay a Room
ALTER TABLE [Service].[RoomStay]
ADD CONSTRAINT FK_RoomStay_Room FOREIGN KEY (RoomId) REFERENCES [Service].[Room](RoomId);
GO

CREATE TABLE [Service].[RoomStayConsumption]
(
    ConsumptionId       INT IDENTITY(1,1) NOT NULL,
    TenantId            UNIQUEIDENTIFIER  NOT NULL,
    RoomStayId          INT               NOT NULL,
    ProductId           INT               NOT NULL,
    Quantity            DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Consumption_Qty DEFAULT 1,
    UnitPrice           DECIMAL(18,4)     NOT NULL,
    SubTotal            DECIMAL(18,4)     NOT NULL,
    Notes               NVARCHAR(200)     NULL,
    CreatedBy           INT               NULL,
    CreatedOnUtc        DATETIME2         NOT NULL CONSTRAINT DF_Consumption_Created DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RoomStayConsumption PRIMARY KEY CLUSTERED (ConsumptionId),
    CONSTRAINT FK_Consumption_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Consumption_RoomStay FOREIGN KEY (RoomStayId) REFERENCES [Service].[RoomStay](RoomStayId),
    CONSTRAINT FK_Consumption_Product FOREIGN KEY (ProductId) REFERENCES [Inventory].[Product](ProductId)
);
GO

CREATE TABLE [Service].[RoomStayExtension]
(
    ExtensionId         INT IDENTITY(1,1) NOT NULL,
    TenantId            UNIQUEIDENTIFIER  NOT NULL,
    RoomStayId          INT               NOT NULL,
    ServiceStayTypeId   INT               NOT NULL,
    ExtraHours          DECIMAL(5,2)      NOT NULL,
    Cost                DECIMAL(18,4)     NOT NULL,
    NewExpectedEndTimeUtc DATETIME2       NOT NULL,
    CreatedBy           INT               NULL,
    CreatedOnUtc        DATETIME2         NOT NULL CONSTRAINT DF_Extension_Created DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RoomStayExtension PRIMARY KEY CLUSTERED (ExtensionId),
    CONSTRAINT FK_Extension_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Extension_RoomStay FOREIGN KEY (RoomStayId) REFERENCES [Service].[RoomStay](RoomStayId),
    CONSTRAINT FK_Extension_ServiceStayType FOREIGN KEY (ServiceStayTypeId) REFERENCES [Service].[ServiceStayType](ServiceStayTypeId)
);
GO

CREATE TABLE [Service].[FineType]
(
    FineTypeId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    Name            NVARCHAR(120)     NOT NULL, -- 'Daño a lencería', 'Objeto faltante', 'Mancha en alfombra'
    Description     NVARCHAR(300)     NULL,
    DefaultAmount   DECIMAL(18,4)     NOT NULL CONSTRAINT DF_FineType_DefaultAmount DEFAULT 0,
    IsActive        BIT               NOT NULL CONSTRAINT DF_FineType_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_FineType_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_FineType PRIMARY KEY CLUSTERED (FineTypeId),
    CONSTRAINT FK_FineType_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO

CREATE TABLE [Service].[RoomStayFine]
(
    FineId          INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    RoomStayId      INT               NOT NULL,
    FineTypeId      INT               NULL,
    Description     NVARCHAR(300)     NOT NULL, -- Motivo de la multa / daño
    Amount          DECIMAL(18,4)     NOT NULL, -- Monto en la moneda de la cuenta
    CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_Fine_Currency DEFAULT 'NIO',
    AmountInBase    DECIMAL(18,4)     NOT NULL, -- Monto convertido a NIO
    ExchangeRate    DECIMAL(18,8)     NOT NULL CONSTRAINT DF_Fine_Rate DEFAULT 1.0,
    IsWaived        BIT               NOT NULL CONSTRAINT DF_Fine_IsWaived DEFAULT 0,
    WaivedReason    NVARCHAR(300)     NULL,
    WaivedBy        INT               NULL,
    WaivedAtUtc     DATETIME2         NULL,
    RecordedBy      INT               NULL,
    RecordedAtUtc   DATETIME2         NOT NULL CONSTRAINT DF_Fine_Recorded DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RoomStayFine PRIMARY KEY CLUSTERED (FineId),
    CONSTRAINT FK_RoomStayFine_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_RoomStayFine_RoomStay FOREIGN KEY (RoomStayId) REFERENCES [Service].[RoomStay](RoomStayId),
    CONSTRAINT FK_RoomStayFine_FineType FOREIGN KEY (FineTypeId) REFERENCES [Service].[FineType](FineTypeId),
    CONSTRAINT CK_RoomStayFine_Amount CHECK (Amount > 0)
);
GO

CREATE TABLE [Service].[RoomReservation]
(
    ReservationId       INT IDENTITY(1,1) NOT NULL,
    TenantId            UNIQUEIDENTIFIER  NOT NULL,
    LocationId          UNIQUEIDENTIFIER  NULL,
    RoomId              INT               NOT NULL,
    CustomerId          INT               NULL,
    CustomerName        NVARCHAR(150)     NOT NULL,
    Phone               NVARCHAR(50)      NULL,
    ServiceStayTypeId   INT               NOT NULL,
    ReservationStartUtc DATETIME2         NOT NULL,
    ReservationEndUtc   DATETIME2         NOT NULL,
    DepositAmount       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Reservation_Deposit DEFAULT 0,
    [Status]            TINYINT           NOT NULL CONSTRAINT DF_Reservation_Status DEFAULT 1, -- 1 = Confirmada, 2 = CheckIn/Ocupada, 3 = Cancelada, 4 = NoShow
    Notes               NVARCHAR(500)     NULL,
    CreatedBy           INT               NULL,
    CreatedOnUtc        DATETIME2         NOT NULL CONSTRAINT DF_Reservation_Created DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_RoomReservation PRIMARY KEY CLUSTERED (ReservationId),
    CONSTRAINT FK_Reservation_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Reservation_Room FOREIGN KEY (RoomId) REFERENCES [Service].[Room](RoomId),
    CONSTRAINT FK_Reservation_Customer FOREIGN KEY (CustomerId) REFERENCES [Service].[Customer](CustomerId),
    CONSTRAINT FK_Reservation_StayType FOREIGN KEY (ServiceStayTypeId) REFERENCES [Service].[ServiceStayType](ServiceStayTypeId)
);
GO
