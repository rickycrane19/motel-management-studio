using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Inventory.Categories.Queries.GetCategoriesQuery;
using MotelMS.Application.Features.Inventory.CustomerReturns.Commands.CreateCustomerReturnCommand;
using MotelMS.Application.Features.Inventory.CustomerReturns.Queries.GetCustomerReturnDetailQuery;
using MotelMS.Application.Features.Inventory.CustomerReturns.Queries.GetCustomerReturnsQuery;
using MotelMS.Application.Features.Inventory.InventoryMovements.Commands.RecordInventoryMovementCommand;
using MotelMS.Application.Features.Inventory.InventoryMovements.Queries.GetInventoryMovementsQuery;
using MotelMS.Application.Features.Inventory.InventoryMovements.Queries.GetInventoryMovementStatsQuery;
using MotelMS.Application.Features.Inventory.Products.Commands.InsertProductCommand;
using MotelMS.Application.Features.Inventory.Products.Commands.SetProductActiveCommand;
using MotelMS.Application.Features.Inventory.Products.Commands.UpdateProductCommand;
using MotelMS.Application.Features.Inventory.Products.Queries.GetProductsQuery;
using MotelMS.Application.Features.Inventory.Products.Queries.GetProductStatsQuery;
using MotelMS.Application.Features.Inventory.Purchases.Commands.CreatePurchaseCommand;
using MotelMS.Application.Features.Inventory.Purchases.Queries.GetPurchaseDetailQuery;
using MotelMS.Application.Features.Inventory.Purchases.Queries.GetPurchasesQuery;
using MotelMS.Application.Features.Inventory.Suppliers.Commands.InsertSupplierCommand;
using MotelMS.Application.Features.Inventory.Suppliers.Commands.SetSupplierActiveCommand;
using MotelMS.Application.Features.Inventory.Suppliers.Commands.UpdateSupplierCommand;
using MotelMS.Application.Features.Inventory.Suppliers.Queries.GetSupplierByIdQuery;
using MotelMS.Application.Features.Inventory.Suppliers.Queries.GetSuppliersQuery;
using MotelMS.WebAPI.Extensions;
using MotelMS.WebAPI.Realtime;

namespace MotelMS.WebAPI.Endpoints.Inventory;

public sealed class InventoryEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/inventory").WithTags("Inventory").RequireAuthorization();

        // ── Productos ───────────────────────────────────────────────────────────
        group.MapGet("/products", async (
            string? search,
            bool? onlyActive,
            int? categoryId,
            int? productId,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetProductsQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetProductsQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                categoryId,
                productId,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        group.MapGet("/products/stats", async (
            ICurrentUserService currentUser,
            GetProductStatsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetProductStatsQuery(currentUser.TenantId), ct);
            return result.ToOk();
        });

        // Ficha por Id: reutiliza el listado filtrado por @ProductId con una sola fila.
        group.MapGet("/products/{productId:int}", async (
            int productId,
            ICurrentUserService currentUser,
            GetProductsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(
                new GetProductsQuery(currentUser.TenantId, ProductId: productId, Page: 1, PageSize: 1), ct);
            if (result.IsFailure)
                return result.ToOk();

            var product = result.Value.Items.FirstOrDefault();
            return product is null ? Results.NotFound() : Results.Ok(product);
        });

        group.MapPost("/products", async (
            InsertProductCommand command,
            IValidator<InsertProductCommand> validator,
            ICurrentUserService currentUser,
            InsertProductCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "ProductCreated", new { productId = result.Value });

            return result.ToCreated(id => $"api/inventory/products/{id}");
        });

        group.MapPut("/products/{productId:int}", async (
            int productId,
            UpdateProductCommand command,
            IValidator<UpdateProductCommand> validator,
            ICurrentUserService currentUser,
            UpdateProductCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { ProductId = productId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "ProductUpdated", new { productId });

            return result.ToNoContent();
        });

        group.MapPut("/products/{productId:int}/set-active", async (
            int productId,
            SetProductActiveCommand command,
            IValidator<SetProductActiveCommand> validator,
            ICurrentUserService currentUser,
            SetProductActiveCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { ProductId = productId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "ProductVisibilityChanged", new { productId });

            return result.ToNoContent();
        });

        // ── Proveedores ─────────────────────────────────────────────────────────
        group.MapGet("/suppliers", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetSuppliersQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetSuppliersQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 50);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        group.MapGet("/suppliers/{supplierId:int}", async (
            int supplierId,
            ICurrentUserService currentUser,
            GetSupplierByIdQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetSupplierByIdQuery(currentUser.TenantId, supplierId), ct);
            return result.ToOk();
        });

        group.MapPost("/suppliers", async (
            InsertSupplierCommand command,
            IValidator<InsertSupplierCommand> validator,
            ICurrentUserService currentUser,
            InsertSupplierCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "SupplierCreated", new { supplierId = result.Value });

            return result.ToCreated(id => $"api/inventory/suppliers/{id}");
        });

        group.MapPut("/suppliers/{supplierId:int}", async (
            int supplierId,
            UpdateSupplierCommand command,
            IValidator<UpdateSupplierCommand> validator,
            ICurrentUserService currentUser,
            UpdateSupplierCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { SupplierId = supplierId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "SupplierUpdated", new { supplierId });

            return result.ToNoContent();
        });

        group.MapPut("/suppliers/{supplierId:int}/set-active", async (
            int supplierId,
            SetSupplierActiveCommand command,
            IValidator<SetSupplierActiveCommand> validator,
            ICurrentUserService currentUser,
            SetSupplierActiveCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with { SupplierId = supplierId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "SupplierVisibilityChanged", new { supplierId });

            return result.ToNoContent();
        });

        // ── Categorías ──────────────────────────────────────────────────────────
        group.MapGet("/categories", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetCategoriesQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetCategoriesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        // ── Movimientos de Kardex ────────────────────────────────────────────────
        group.MapGet("/movements", async (
            int? productId,
            string? movementType,
            DateTime? from,
            DateTime? to,
            string? search,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetInventoryMovementsQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetInventoryMovementsQuery(
                currentUser.TenantId,
                productId,
                string.IsNullOrWhiteSpace(movementType) ? null : movementType.Trim(),
                from,
                to,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        group.MapGet("/movements/stats", async (
            DateTime? from,
            DateTime? to,
            ICurrentUserService currentUser,
            GetInventoryMovementStatsQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(
                new GetInventoryMovementStatsQuery(currentUser.TenantId, from, to), ct);
            return result.ToOk();
        });

        group.MapPost("/movements", async (
            RecordInventoryMovementCommand command,
            IValidator<RecordInventoryMovementCommand> validator,
            ICurrentUserService currentUser,
            RecordInventoryMovementCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "StockMoved", new { productId = request.ProductId });

            return result.ToCreated(id => $"api/inventory/movements/{id}");
        });

        // ── Compras y devoluciones a proveedor ───────────────────────────────────
        group.MapGet("/purchases", async (
            string? search,
            string? type,
            DateTime? from,
            DateTime? to,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetPurchasesQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetPurchasesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                string.IsNullOrWhiteSpace(type) ? null : type.Trim(),
                from,
                to,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        group.MapGet("/purchases/{purchaseId:int}", async (
            int purchaseId,
            ICurrentUserService currentUser,
            GetPurchaseDetailQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetPurchaseDetailQuery(currentUser.TenantId, purchaseId), ct);
            return result.ToOk();
        });

        group.MapPost("/purchases", async (
            CreatePurchaseCommand command,
            IValidator<CreatePurchaseCommand> validator,
            ICurrentUserService currentUser,
            CreatePurchaseCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "PurchaseCreated", new { purchaseId = result.Value, purchaseType = request.PurchaseType });

            return result.ToCreated(id => $"api/inventory/purchases/{id}");
        });

        // ── Devoluciones de cliente ──────────────────────────────────────────────
        group.MapGet("/customer-returns", async (
            string? search,
            DateTime? from,
            DateTime? to,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetCustomerReturnsQueryHandler handler,
            CancellationToken ct) =>
        {
            var query = new GetCustomerReturnsQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                from,
                to,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        });

        group.MapGet("/customer-returns/{customerReturnId:int}", async (
            int customerReturnId,
            ICurrentUserService currentUser,
            GetCustomerReturnDetailQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCustomerReturnDetailQuery(currentUser.TenantId, customerReturnId), ct);
            return result.ToOk();
        });

        group.MapPost("/customer-returns", async (
            CreateCustomerReturnCommand command,
            IValidator<CreateCustomerReturnCommand> validator,
            ICurrentUserService currentUser,
            CreateCustomerReturnCommandHandler handler,
            IRealtimePublisher publisher,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId,
                CreatedBy = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            if (result.IsSuccess)
                await publisher.InventoryChangedAsync(currentUser.TenantId, "CustomerReturnCreated", new { customerReturnId = result.Value });

            return result.ToCreated(id => $"api/inventory/customer-returns/{id}");
        });
    }
}
