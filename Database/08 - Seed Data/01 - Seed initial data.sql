USE MotelMSDB;
GO

SET NOCOUNT ON;

-- 1. Tenant y Sucursal
DECLARE @TenantId UNIQUEIDENTIFIER = 'E0000000-0000-0000-0000-000000000001';
DECLARE @LocationId UNIQUEIDENTIFIER = 'C0000000-0000-0000-0000-000000000001';

IF NOT EXISTS (SELECT 1 FROM [Tenant].[Tenants] WHERE TenantId = @TenantId)
BEGIN
    INSERT INTO [Tenant].[Tenants] (TenantId, Name, LegalName, Phone, Email, Address, TimeZone, CurrencyCode, IsActive)
    VALUES (@TenantId, N'Auto Hotel El Paraíso', N'Inversiones El Paraíso S.A.', N'2255-9000', N'contacto@autohotelparaiso.com', N'Km 11 Carretera a Masaya, Managua', 'America/Managua', 'NIO', 1);
END

IF NOT EXISTS (SELECT 1 FROM [Tenant].[TenantLocations] WHERE LocationId = @LocationId)
BEGIN
    INSERT INTO [Tenant].[TenantLocations] (LocationId, TenantId, Name, Address, Phone, IsActive)
    VALUES (@LocationId, @TenantId, N'Sucursal Principal Managua', N'Km 11 Carretera a Masaya', N'2255-9000', 1);
END

-- 2. Monedas
IF NOT EXISTS (SELECT 1 FROM [Configuration].[Currency] WHERE CurrencyCode = 'NIO')
    INSERT INTO [Configuration].[Currency] (CurrencyCode, Name, Symbol, ExchangeRateToDefault, IsBase, IsActive)
    VALUES ('NIO', N'Córdoba Nicaragüense', N'C$', 1.0, 1, 1);

IF NOT EXISTS (SELECT 1 FROM [Configuration].[Currency] WHERE CurrencyCode = 'USD')
    INSERT INTO [Configuration].[Currency] (CurrencyCode, Name, Symbol, ExchangeRateToDefault, IsBase, IsActive)
    VALUES ('USD', N'Dólar Estadounidense', N'$', 36.80, 0, 1);

IF NOT EXISTS (SELECT 1 FROM [Configuration].[Currency] WHERE CurrencyCode = 'CRC')
    INSERT INTO [Configuration].[Currency] (CurrencyCode, Name, Symbol, ExchangeRateToDefault, IsBase, IsActive)
    VALUES ('CRC', N'Colón Costarricense', N'₡', 0.072, 0, 1);

-- 3. Tasas de Cambio
IF NOT EXISTS (SELECT 1 FROM [Configuration].[ExchangeRate] WHERE TenantId = @TenantId AND FromCurrencyCode = 'USD' AND ToCurrencyCode = 'NIO')
    INSERT INTO [Configuration].[ExchangeRate] (TenantId, FromCurrencyCode, ToCurrencyCode, ExchangeRateValue)
    VALUES (@TenantId, 'USD', 'NIO', 36.80);

IF NOT EXISTS (SELECT 1 FROM [Configuration].[ExchangeRate] WHERE TenantId = @TenantId AND FromCurrencyCode = 'CRC' AND ToCurrencyCode = 'NIO')
    INSERT INTO [Configuration].[ExchangeRate] (TenantId, FromCurrencyCode, ToCurrencyCode, ExchangeRateValue)
    VALUES (@TenantId, 'CRC', 'NIO', 0.072);

-- 4. Denominaciones
MERGE [Finance].[CashBoxDenomination] AS target
USING (VALUES
    -- Córdobas (NIO)
    ('NIO', 1000.0, N'Billete C$1,000'),
    ('NIO', 500.0,  N'Billete C$500'),
    ('NIO', 200.0,  N'Billete C$200'),
    ('NIO', 100.0,  N'Billete C$100'),
    ('NIO', 50.0,   N'Billete C$50'),
    ('NIO', 20.0,   N'Billete C$20'),
    ('NIO', 10.0,   N'Billete/Moneda C$10'),
    ('NIO', 5.0,    N'Moneda C$5'),
    -- Dólares (USD)
    ('USD', 100.0,  N'Billete $100'),
    ('USD', 50.0,   N'Billete $50'),
    ('USD', 20.0,   N'Billete $20'),
    ('USD', 10.0,   N'Billete $10'),
    ('USD', 5.0,    N'Billete $5'),
    ('USD', 1.0,    N'Billete $1'),
    -- Colones (CRC)
    ('CRC', 20000.0, N'Billete ₡20,000'),
    ('CRC', 10000.0, N'Billete ₡10,000'),
    ('CRC', 5000.0,  N'Billete ₡5,000'),
    ('CRC', 2000.0,  N'Billete ₡2,000'),
    ('CRC', 1000.0,  N'Billete ₡1,000')
) AS source (CurrencyCode, [Value], Label)
ON target.CurrencyCode = source.CurrencyCode AND target.[Value] = source.[Value]
WHEN NOT MATCHED THEN
    INSERT (CurrencyCode, [Value], Label, IsActive)
    VALUES (source.CurrencyCode, source.[Value], source.Label, 1);

-- 5. Usuarios (contraseña bootstrap: '123456' - hash SHA256 heredado, el backend lo acepta por compatibilidad)
DECLARE @PassHash NVARCHAR(256) = N'8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; -- SHA256('123456')

IF NOT EXISTS (SELECT 1 FROM [Security].[User] WHERE TenantId = @TenantId AND Username = N'admin')
BEGIN
    INSERT INTO [Security].[User] (TenantId, LocationId, Username, Email, PasswordHash, FullName, Role, IsActive)
    VALUES (@TenantId, @LocationId, N'admin', N'admin@motel.com', @PassHash, N'Administrador General', N'Admin', 1);
END

IF NOT EXISTS (SELECT 1 FROM [Security].[User] WHERE TenantId = @TenantId AND Username = N'recepcion')
BEGIN
    INSERT INTO [Security].[User] (TenantId, LocationId, Username, Email, PasswordHash, FullName, Role, IsActive)
    VALUES (@TenantId, @LocationId, N'recepcion', N'recepcion@motel.com', @PassHash, N'Recepcionista de Turno', N'Receptionist', 1);
END

-- 6. Caja física
IF NOT EXISTS (SELECT 1 FROM [Finance].[CashBox] WHERE TenantId = @TenantId AND Code = N'CAJA-01')
BEGIN
    INSERT INTO [Finance].[CashBox] (TenantId, LocationId, Name, Code, IsActive)
    VALUES (@TenantId, @LocationId, N'Caja Principal Recepción', N'CAJA-01', 1);
END

-- 7. Tipos de Habitación
IF NOT EXISTS (SELECT 1 FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Sencilla con Cochera')
    INSERT INTO [Service].[RoomType] (TenantId, Name, Description, BasePrice, HasGarage, HasJacuzzi, Capacity, IsActive)
    VALUES (@TenantId, N'Sencilla con Cochera', N'Habitación privada con portón eléctrico y cama King', 350.0, 1, 0, 2, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Suite Jacuzzi VIP')
    INSERT INTO [Service].[RoomType] (TenantId, Name, Description, BasePrice, HasGarage, HasJacuzzi, Capacity, IsActive)
    VALUES (@TenantId, N'Suite Jacuzzi VIP', N'Suite con tina de hidromasaje, luces LED y garage privado', 650.0, 1, 1, 2, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Master Cabaña con Piscina')
    INSERT INTO [Service].[RoomType] (TenantId, Name, Description, BasePrice, HasGarage, HasJacuzzi, Capacity, IsActive)
    VALUES (@TenantId, N'Master Cabaña con Piscina', N'Área exclusiva con alberca privada y sala lounge', 1200.0, 1, 1, 4, 1);

-- 8. Habitaciones
DECLARE @TypeSencilla INT = (SELECT TOP 1 RoomTypeId FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Sencilla con Cochera');
DECLARE @TypeJacuzzi INT = (SELECT TOP 1 RoomTypeId FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Suite Jacuzzi VIP');
DECLARE @TypeCabana INT = (SELECT TOP 1 RoomTypeId FROM [Service].[RoomType] WHERE TenantId = @TenantId AND Name = N'Master Cabaña con Piscina');

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'101')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'101', @TypeSencilla, 0, 1, N'Cochera cerrada lado norte', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'102')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'102', @TypeSencilla, 0, 1, N'Cochera cerrada', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'103')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'103', @TypeSencilla, 0, 1, N'Cochera cerrada', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'104')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'104', @TypeSencilla, 0, 1, N'Cochera cerrada', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'201')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'201', @TypeJacuzzi, 0, 2, N'Jacuzzi con hidromasaje', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'202')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'202', @TypeJacuzzi, 0, 2, N'Jacuzzi con cascada', 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[Room] WHERE TenantId = @TenantId AND RoomNumber = N'301')
    INSERT INTO [Service].[Room] (TenantId, LocationId, RoomNumber, RoomTypeId, [Status], FloorNumber, Notes, IsActive)
    VALUES (@TenantId, @LocationId, N'301', @TypeCabana, 0, 3, N'Cabaña presidencial con alberca', 1);

-- 9. Tipos de Servicio de Estancia y Tarifas
IF NOT EXISTS (SELECT 1 FROM [Service].[ServiceStayType] WHERE TenantId = @TenantId AND Name = N'Rato 2 Horas')
    INSERT INTO [Service].[ServiceStayType] (TenantId, RoomTypeId, Name, DurationHours, Price, IsExtension, IsActive)
    VALUES (@TenantId, @TypeSencilla, N'Rato 2 Horas', 2.0, 350.0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[ServiceStayType] WHERE TenantId = @TenantId AND Name = N'Rato 3 Horas')
    INSERT INTO [Service].[ServiceStayType] (TenantId, RoomTypeId, Name, DurationHours, Price, IsExtension, IsActive)
    VALUES (@TenantId, @TypeSencilla, N'Rato 3 Horas', 3.0, 450.0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[ServiceStayType] WHERE TenantId = @TenantId AND Name = N'Noche Completa (Amanecida)')
    INSERT INTO [Service].[ServiceStayType] (TenantId, RoomTypeId, Name, DurationHours, Price, IsExtension, IsActive)
    VALUES (@TenantId, @TypeSencilla, N'Noche Completa (Amanecida)', 12.0, 800.0, 0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[ServiceStayType] WHERE TenantId = @TenantId AND Name = N'Hora Extra')
    INSERT INTO [Service].[ServiceStayType] (TenantId, RoomTypeId, Name, DurationHours, Price, IsExtension, IsActive)
    VALUES (@TenantId, @TypeSencilla, N'Hora Extra', 1.0, 150.0, 1, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[ServiceStayType] WHERE TenantId = @TenantId AND Name = N'Extensión 2 Horas')
    INSERT INTO [Service].[ServiceStayType] (TenantId, RoomTypeId, Name, DurationHours, Price, IsExtension, IsActive)
    VALUES (@TenantId, @TypeSencilla, N'Extensión 2 Horas', 2.0, 250.0, 1, 1);

-- 10. Categorías y Productos de Minibar
DECLARE @CatBebidas INT, @CatLicores INT, @CatFarmacia INT, @CatSnacks INT;

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Bebidas & Refrescos')
    INSERT INTO [Inventory].[Category] (TenantId, Name, Description, IsActive) VALUES (@TenantId, N'Bebidas & Refrescos', N'Gaseosas, aguas y energizantes', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Cervezas & Licores')
    INSERT INTO [Inventory].[Category] (TenantId, Name, Description, IsActive) VALUES (@TenantId, N'Cervezas & Licores', N'Cervezas nacionales e importadas y licores', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Farmacia & Higiene')
    INSERT INTO [Inventory].[Category] (TenantId, Name, Description, IsActive) VALUES (@TenantId, N'Farmacia & Higiene', N'Preservativos, lubricantes y artículos personales', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Snacks')
    INSERT INTO [Inventory].[Category] (TenantId, Name, Description, IsActive) VALUES (@TenantId, N'Snacks', N'Papas, chocolates y confitería', 1);

SELECT @CatBebidas = CategoryId FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Bebidas & Refrescos';
SELECT @CatLicores = CategoryId FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Cervezas & Licores';
SELECT @CatFarmacia = CategoryId FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Farmacia & Higiene';
SELECT @CatSnacks = CategoryId FROM [Inventory].[Category] WHERE TenantId = @TenantId AND Name = N'Snacks';

-- Insertar productos
IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'BEB-001')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatBebidas, N'BEB-001', N'Coca Cola 500ml', N'Gaseosa Coca Cola pet', 22.0, 35.0, 50.0, 10.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'BEB-002')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatBebidas, N'BEB-002', N'Red Bull 250ml', N'Bebida energizante Red Bull', 60.0, 95.0, 25.0, 5.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'BEB-003')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatBebidas, N'BEB-003', N'Agua Purificada 600ml', N'Agua embotellada natural', 12.0, 25.0, 60.0, 10.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'LIC-001')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatLicores, N'LIC-001', N'Cerveza Toña 350ml', N'Cerveza nacional lata', 32.0, 50.0, 45.0, 10.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'LIC-002')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatLicores, N'LIC-002', N'Cerveza Victoria Clásica 350ml', N'Cerveza nacional lata', 32.0, 50.0, 30.0, 10.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'FAR-001')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatFarmacia, N'FAR-001', N'Preservativos Durex Placer Prolongado', N'Caja x3 unidades', 75.0, 120.0, 40.0, 8.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'FAR-002')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatFarmacia, N'FAR-002', N'Preservativos Prudence Sabor Fresa', N'Caja x3 unidades', 50.0, 85.0, 50.0, 10.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'FAR-003')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatFarmacia, N'FAR-003', N'Lubricante Íntimo Neutro 50g', N'Gel lubricante base agua', 90.0, 150.0, 20.0, 5.0, 'UND', 1);

IF NOT EXISTS (SELECT 1 FROM [Inventory].[Product] WHERE TenantId = @TenantId AND Code = N'SNK-001')
    INSERT INTO [Inventory].[Product] (TenantId, LocationId, CategoryId, Code, Name, Description, CostPrice, SalePrice, CurrentStock, MinStock, UnitOfMeasure, IsActive)
    VALUES (@TenantId, @LocationId, @CatSnacks, N'SNK-001', N'Papitas Lays Clásicas', N'Bolsa mediana de papas', 25.0, 40.0, 30.0, 5.0, 'UND', 1);

-- 11. Empleados iniciales
IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE TenantId = @TenantId AND FullName = N'Carlos Mendoza')
    INSERT INTO [HR].[Employee] (TenantId, LocationId, FullName, Position, PaymentType, Rate, CurrencyCode, Phone, IsActive)
    VALUES (@TenantId, @LocationId, N'Carlos Mendoza', N'Recepcionista', 'PerShift', 400.0, 'NIO', N'8811-2233', 1);

IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE TenantId = @TenantId AND FullName = N'Marta Gómez')
    INSERT INTO [HR].[Employee] (TenantId, LocationId, FullName, Position, PaymentType, Rate, CurrencyCode, Phone, IsActive)
    VALUES (@TenantId, @LocationId, N'Marta Gómez', N'Mucama / Limpieza', 'Daily', 350.0, 'NIO', N'8844-5566', 1);

IF NOT EXISTS (SELECT 1 FROM [HR].[Employee] WHERE TenantId = @TenantId AND FullName = N'Roberto Silva')
    INSERT INTO [HR].[Employee] (TenantId, LocationId, FullName, Position, PaymentType, Rate, CurrencyCode, Phone, IsActive)
    VALUES (@TenantId, @LocationId, N'Roberto Silva', N'Seguridad / Portón', 'Hourly', 45.0, 'NIO', N'8877-8899', 1);

-- 12. Tipos de Multa (daños / objetos faltantes)
IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE TenantId = @TenantId AND Name = N'Daño a lencería / sábanas')
    INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive)
    VALUES (@TenantId, N'Daño a lencería / sábanas', N'Manchas o roturas en sábanas, cobertores o toallas', 250.0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE TenantId = @TenantId AND Name = N'Objeto faltante en habitación')
    INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive)
    VALUES (@TenantId, N'Objeto faltante en habitación', N'Falta de control de TV, secadora, toallas u otros enseres', 300.0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE TenantId = @TenantId AND Name = N'Daño a mobiliario / jacuzzi')
    INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive)
    VALUES (@TenantId, N'Daño a mobiliario / jacuzzi', N'Golpes, roturas o daños a mobiliario, espejos o hidromasaje', 800.0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE TenantId = @TenantId AND Name = N'Mancha difícil / limpieza profunda')
    INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive)
    VALUES (@TenantId, N'Mancha difícil / limpieza profunda', N'Limpieza especial requerida por manchas o residuos', 400.0, 1);

IF NOT EXISTS (SELECT 1 FROM [Service].[FineType] WHERE TenantId = @TenantId AND Name = N'Uso indebido / humo')
    INSERT INTO [Service].[FineType] (TenantId, Name, Description, DefaultAmount, IsActive)
    VALUES (@TenantId, N'Uso indebido / humo', N'Fumar dentro de la habitación o exceso de ocupantes', 200.0, 1);

PRINT N'Datos semilla de MotelMSDB insertados correctamente.';
GO
