using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Service.Customers.Commands.InsertCustomerCommand;
using MotelMS.Application.Features.Service.Customers.Commands.SetCustomerActiveCommand;
using MotelMS.Application.Features.Service.Customers.Commands.UpdateCustomerCommand;
using MotelMS.Application.Features.Service.Customers.Queries.GetCustomersQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Service;

public sealed class CustomerEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/service/customers").WithTags("Service.Customers").RequireAuthorization();

        group.MapGet("/", async (
            string? search,
            bool? onlyActive,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetCustomersQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetCustomersQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapPost("/", async (
            InsertCustomerCommand command,
            IValidator<InsertCustomerCommand> validator,
            ICurrentUserService currentUser,
            InsertCustomerCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/service/customers/{id}");
        });

        group.MapPut("/{customerId:int}", async (
            int customerId,
            UpdateCustomerCommand command,
            IValidator<UpdateCustomerCommand> validator,
            ICurrentUserService currentUser,
            UpdateCustomerCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { CustomerId = customerId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });

        group.MapPut("/{customerId:int}/set-active", async (
            int customerId,
            SetCustomerActiveCommand command,
            IValidator<SetCustomerActiveCommand> validator,
            ICurrentUserService currentUser,
            SetCustomerActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { CustomerId = customerId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });
    }
}
