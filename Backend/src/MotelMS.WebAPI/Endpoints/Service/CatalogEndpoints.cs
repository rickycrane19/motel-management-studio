using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Service.Catalogs.Commands.InsertServiceStayTypeCommand;
using MotelMS.Application.Features.Service.Catalogs.Commands.SetServiceStayTypeActiveCommand;
using MotelMS.Application.Features.Service.Catalogs.Commands.UpdateServiceStayTypeCommand;
using MotelMS.Application.Features.Service.Catalogs.Queries.GetRoomTypesQuery;
using MotelMS.Application.Features.Service.Catalogs.Queries.GetServiceStayTypesQuery;
using MotelMS.Application.Features.Service.FineTypes.Commands.InsertFineTypeCommand;
using MotelMS.Application.Features.Service.FineTypes.Commands.SetFineTypeActiveCommand;
using MotelMS.Application.Features.Service.FineTypes.Commands.UpdateFineTypeCommand;
using MotelMS.Application.Features.Service.FineTypes.Queries.GetFineTypesQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Service;

public sealed class CatalogEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/service").WithTags("Service.Catalogs").RequireAuthorization();

        // Tipos de habitación
        group.MapGet("/room-types", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetRoomTypesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetRoomTypesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        // Tipos de servicio de estancia y extensiones
        group.MapGet("/stay-types", async (
            string? search,
            bool? onlyActive,
            bool? isExtension,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetServiceStayTypesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetServiceStayTypesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                isExtension,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapGet("/catalogs/stay-types", async (
            string? search,
            bool? onlyActive,
            bool? isExtension,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetServiceStayTypesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetServiceStayTypesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                isExtension,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapPost("/stay-types", async (
            InsertServiceStayTypeCommand command,
            IValidator<InsertServiceStayTypeCommand> validator,
            ICurrentUserService currentUser,
            InsertServiceStayTypeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/service/stay-types/{id}");
        });

        group.MapPut("/stay-types/{serviceStayTypeId:int}", async (
            int serviceStayTypeId,
            UpdateServiceStayTypeCommand command,
            IValidator<UpdateServiceStayTypeCommand> validator,
            ICurrentUserService currentUser,
            UpdateServiceStayTypeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { ServiceStayTypeId = serviceStayTypeId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });

        group.MapPut("/stay-types/{serviceStayTypeId:int}/set-active", async (
            int serviceStayTypeId,
            SetServiceStayTypeActiveCommand command,
            IValidator<SetServiceStayTypeActiveCommand> validator,
            ICurrentUserService currentUser,
            SetServiceStayTypeActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { ServiceStayTypeId = serviceStayTypeId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });

        // Tipos de multa / daños
        group.MapGet("/fine-types", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetFineTypesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetFineTypesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapGet("/catalogs/fine-types", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetFineTypesQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetFineTypesQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapPost("/fine-types", async (
            InsertFineTypeCommand command,
            IValidator<InsertFineTypeCommand> validator,
            ICurrentUserService currentUser,
            InsertFineTypeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/service/fine-types/{id}");
        });

        group.MapPut("/fine-types/{fineTypeId:int}", async (
            int fineTypeId,
            UpdateFineTypeCommand command,
            IValidator<UpdateFineTypeCommand> validator,
            ICurrentUserService currentUser,
            UpdateFineTypeCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { FineTypeId = fineTypeId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });

        group.MapPut("/fine-types/{fineTypeId:int}/set-active", async (
            int fineTypeId,
            SetFineTypeActiveCommand command,
            IValidator<SetFineTypeActiveCommand> validator,
            ICurrentUserService currentUser,
            SetFineTypeActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { FineTypeId = fineTypeId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });
    }
}
