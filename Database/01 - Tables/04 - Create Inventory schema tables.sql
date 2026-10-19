USE [MotelMSDB];
GO

IF OBJECT_ID(N'Inventory.InventoryMovement', 'U') IS NOT NULL DROP TABLE [Inventory].[InventoryMovement];
IF OBJECT_ID(N'Inventory.Product', 'U') IS NOT NULL DROP TABLE [Inventory].[Product];
IF OBJECT_ID(N'Inventory.Category', 'U') IS NOT NULL DROP TABLE [Inventory].[Category];
GO

CREATE TABLE [Inventory].[Category]
(
    CategoryId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    Name            NVARCHAR(100)     NOT NULL,
    Description     NVARCHAR(250)     NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_Category_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Category_CreatedOn DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Category PRIMARY KEY CLUSTERED (CategoryId),
    CONSTRAINT FK_Category_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId)
);
GO

CREATE TABLE [Inventory].[Product]
(
    ProductId       INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    CategoryId      INT               NOT NULL,
    Code            NVARCHAR(50)      NOT NULL,
    Name            NVARCHAR(150)     NOT NULL,
    Description     NVARCHAR(500)     NULL,
    CostPrice       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Product_CostPrice DEFAULT 0,
    SalePrice       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Product_SalePrice DEFAULT 0,
    CurrentStock    DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Product_CurrentStock DEFAULT 0,
    MinStock        DECIMAL(12,2)     NOT NULL CONSTRAINT DF_Product_MinStock DEFAULT 5,
    UnitOfMeasure   NVARCHAR(20)      NOT NULL CONSTRAINT DF_Product_Unit DEFAULT 'UND',
    ImageUrl        NVARCHAR(500)     NULL,
    IsActive        BIT               NOT NULL CONSTRAINT DF_Product_IsActive DEFAULT 1,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Product_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT               NULL,

    CONSTRAINT PK_Product PRIMARY KEY CLUSTERED (ProductId),
    CONSTRAINT FK_Product_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Product_Location FOREIGN KEY (LocationId) REFERENCES [Tenant].[TenantLocations](LocationId),
    CONSTRAINT FK_Product_Category FOREIGN KEY (CategoryId) REFERENCES [Inventory].[Category](CategoryId)
);
GO

CREATE TABLE [Inventory].[InventoryMovement]
(
    MovementId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    ProductId       INT               NOT NULL,
    MovementType    NVARCHAR(30)      NOT NULL, -- 'Compra', 'Venta', 'AjusteEntrada', 'AjusteSalida', 'DevolucionProveedor', 'DevolucionCliente'
    Quantity        DECIMAL(12,2)     NOT NULL,
    PreviousStock   DECIMAL(12,2)     NOT NULL,
    NewStock        DECIMAL(12,2)     NOT NULL,
    UnitCost        DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Movement_UnitCost DEFAULT 0,
    TotalCost       DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Movement_TotalCost DEFAULT 0,
    Reason          NVARCHAR(250)     NULL,
    ReferenceDoc    NVARCHAR(100)     NULL,
    RoomStayId      INT               NULL,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Movement_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT               NULL,

    CONSTRAINT PK_InventoryMovement PRIMARY KEY CLUSTERED (MovementId),
    CONSTRAINT FK_Movement_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Movement_Product FOREIGN KEY (ProductId) REFERENCES [Inventory].[Product](ProductId),
    CONSTRAINT CK_Movement_Type CHECK (MovementType IN ('Compra', 'Venta', 'AjusteEntrada', 'AjusteSalida', 'DevolucionProveedor', 'DevolucionCliente'))
);
GO

/* ──────────────────────────────────────────────────────────────────────────────
   COMPRAS Y DEVOLUCIONES DE INVENTARIO (con impacto en el dinero de caja)
   ────────────────────────────────────────────────────────────────────────────── */

CREATE TABLE [Inventory].[Purchase]
(
    PurchaseId      INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    PurchaseType    NVARCHAR(30)      NOT NULL, -- 'Compra' | 'DevolucionProveedor'
    SupplierName    NVARCHAR(150)     NULL,
    ReferenceDoc    NVARCHAR(100)     NULL,
    TotalAmount     DECIMAL(18,4)     NOT NULL CONSTRAINT DF_Purchase_Total DEFAULT 0,
    CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_Purchase_Currency DEFAULT 'NIO',
    CashBoxSessionId INT             NULL,     -- sesión donde se movió el dinero (pago o reintegro)
    Notes           NVARCHAR(500)     NULL,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Purchase_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT               NULL,

    CONSTRAINT PK_Purchase PRIMARY KEY CLUSTERED (PurchaseId),
    CONSTRAINT FK_Purchase_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_Purchase_Location FOREIGN KEY (LocationId) REFERENCES [Tenant].[TenantLocations](LocationId),
    CONSTRAINT FK_Purchase_CashBoxSession FOREIGN KEY (CashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId),
    CONSTRAINT CK_Purchase_Type CHECK (PurchaseType IN ('Compra', 'DevolucionProveedor')),
    CONSTRAINT CK_Purchase_Total CHECK (TotalAmount >= 0)
);
GO

CREATE TABLE [Inventory].[PurchaseItem]
(
    PurchaseItemId  INT IDENTITY(1,1) NOT NULL,
    PurchaseId      INT               NOT NULL,
    ProductId       INT               NOT NULL,
    Quantity        DECIMAL(12,2)     NOT NULL,
    UnitCost        DECIMAL(18,4)     NOT NULL,
    LineTotal       DECIMAL(18,4)     NOT NULL,
    Notes           NVARCHAR(200)     NULL,

    CONSTRAINT PK_PurchaseItem PRIMARY KEY CLUSTERED (PurchaseItemId),
    CONSTRAINT FK_PurchaseItem_Purchase FOREIGN KEY (PurchaseId) REFERENCES [Inventory].[Purchase](PurchaseId),
    CONSTRAINT FK_PurchaseItem_Product FOREIGN KEY (ProductId) REFERENCES [Inventory].[Product](ProductId),
    CONSTRAINT CK_PurchaseItem_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_PurchaseItem_Total CHECK (LineTotal >= 0)
);
GO

CREATE TABLE [Inventory].[CustomerReturn]
(
    CustomerReturnId INT IDENTITY(1,1) NOT NULL,
    TenantId        UNIQUEIDENTIFIER  NOT NULL,
    LocationId      UNIQUEIDENTIFIER  NULL,
    CustomerName    NVARCHAR(150)     NULL,
    RoomStayId      INT               NULL,
    TotalRefund     DECIMAL(18,4)     NOT NULL CONSTRAINT DF_CustomerReturn_Total DEFAULT 0,
    CurrencyCode    CHAR(3)           NOT NULL CONSTRAINT DF_CustomerReturn_Currency DEFAULT 'NIO',
    CashBoxSessionId INT             NULL,     -- sesión de donde salió el reembolso en efectivo
    Notes           NVARCHAR(500)     NULL,
    CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_CustomerReturn_CreatedOn DEFAULT SYSUTCDATETIME(),
    CreatedBy       INT               NULL,

    CONSTRAINT PK_CustomerReturn PRIMARY KEY CLUSTERED (CustomerReturnId),
    CONSTRAINT FK_CustomerReturn_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
    CONSTRAINT FK_CustomerReturn_Location FOREIGN KEY (LocationId) REFERENCES [Tenant].[TenantLocations](LocationId),
    CONSTRAINT FK_CustomerReturn_CashBoxSession FOREIGN KEY (CashBoxSessionId) REFERENCES [Finance].[CashBoxSession](CashBoxSessionId),
    CONSTRAINT CK_CustomerReturn_Total CHECK (TotalRefund >= 0)
);
GO

CREATE TABLE [Inventory].[CustomerReturnItem]
(
    CustomerReturnItemId INT IDENTITY(1,1) NOT NULL,
    CustomerReturnId INT               NOT NULL,
    ProductId       INT               NOT NULL,
    Quantity        DECIMAL(12,2)     NOT NULL,
    UnitPrice       DECIMAL(18,4)     NOT NULL, -- precio de venta devuelto al cliente
    LineTotal       DECIMAL(18,4)     NOT NULL,
    Notes           NVARCHAR(200)     NULL,

    CONSTRAINT PK_CustomerReturnItem PRIMARY KEY CLUSTERED (CustomerReturnItemId),
    CONSTRAINT FK_CustomerReturnItem_Return FOREIGN KEY (CustomerReturnId) REFERENCES [Inventory].[CustomerReturn](CustomerReturnId),
    CONSTRAINT FK_CustomerReturnItem_Product FOREIGN KEY (ProductId) REFERENCES [Inventory].[Product](ProductId),
    CONSTRAINT CK_CustomerReturnItem_Quantity CHECK (Quantity > 0),
    CONSTRAINT CK_CustomerReturnItem_Total CHECK (LineTotal >= 0)
);
GO

/* ──────────────────────────────────────────────────────────────────────────────
   MAESTRO DE PROVEEDORES
   Catálogo de proveedores del motel; las compras seleccionan uno de aquí.
   Se crea con guardas para poder re-ejecutar solo este bloque sin tocar lo demás.
   ────────────────────────────────────────────────────────────────────────────── */

IF OBJECT_ID(N'Inventory.Supplier', 'U') IS NULL
BEGIN
    CREATE TABLE [Inventory].[Supplier]
    (
        SupplierId      INT IDENTITY(1,1) NOT NULL,
        TenantId        UNIQUEIDENTIFIER  NOT NULL,
        LocationId      UNIQUEIDENTIFIER  NULL,
        Name            NVARCHAR(150)     NOT NULL,
        ContactName     NVARCHAR(150)     NULL,
        Phone           NVARCHAR(50)      NULL,
        Email           NVARCHAR(150)     NULL,
        Address         NVARCHAR(250)     NULL,
        TaxId           NVARCHAR(50)      NULL,     -- RUC
        Notes           NVARCHAR(500)     NULL,
        IsActive        BIT               NOT NULL CONSTRAINT DF_Supplier_IsActive DEFAULT 1,
        CreatedOn       DATETIME2         NOT NULL CONSTRAINT DF_Supplier_CreatedOn DEFAULT SYSUTCDATETIME(),
        CreatedBy       INT               NULL,

        CONSTRAINT PK_Supplier PRIMARY KEY CLUSTERED (SupplierId),
        CONSTRAINT FK_Supplier_Tenant FOREIGN KEY (TenantId) REFERENCES [Tenant].[Tenants](TenantId),
        CONSTRAINT FK_Supplier_Location FOREIGN KEY (LocationId) REFERENCES [Tenant].[TenantLocations](LocationId)
    );
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'UX_Supplier_Tenant_Name' AND object_id = OBJECT_ID(N'Inventory.Supplier')
)
BEGIN
    CREATE UNIQUE INDEX UX_Supplier_Tenant_Name ON [Inventory].[Supplier](TenantId, Name);
END
GO

/* Enlace de la compra con el maestro de proveedores (el nombre en texto libre se conserva). */
IF COL_LENGTH('Inventory.Purchase', 'SupplierId') IS NULL
BEGIN
    ALTER TABLE [Inventory].[Purchase] ADD SupplierId INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = N'FK_Purchase_Supplier' AND parent_object_id = OBJECT_ID(N'Inventory.Purchase')
)
BEGIN
    ALTER TABLE [Inventory].[Purchase]
        ADD CONSTRAINT FK_Purchase_Supplier FOREIGN KEY (SupplierId) REFERENCES [Inventory].[Supplier](SupplierId);
END
GO
