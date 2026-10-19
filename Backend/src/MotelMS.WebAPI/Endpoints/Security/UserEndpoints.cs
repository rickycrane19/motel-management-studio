using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.Security.Users.Commands.InsertUserCommand;
using MotelMS.Application.Features.Security.Users.Commands.SetUserActiveCommand;
using MotelMS.Application.Features.Security.Users.Commands.UpdateUserCommand;
using MotelMS.Application.Features.Security.Users.Queries.GetUserByIdQuery;
using MotelMS.Application.Features.Security.Users.Queries.GetUsersQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Security;

public sealed class UserEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/security/users").WithTags("Security.Users").RequireAuthorization();

        group.MapGet("/", async (
            string? search,
            bool? onlyActive,
            string? role,
            int? page,
            int? pageSize,
            ICurrentUserService currentUser,
            GetUsersQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetUsersQuery(
                currentUser.TenantId,
                string.IsNullOrWhiteSpace(search) ? null : search.Trim(),
                onlyActive,
                string.IsNullOrWhiteSpace(role) ? null : role.Trim(),
                page ?? 1,
                pageSize ?? 20), ct);
            return result.ToOk();
        });

        group.MapGet("/{userId:int}", async (
            int userId,
            ICurrentUserService currentUser,
            GetUserByIdQueryHandler handler,
            CancellationToken ct) =>
        {
            var result = await handler.HandleAsync(new GetUserByIdQuery(currentUser.TenantId, userId), ct);
            return result.ToOk();
        });

        group.MapPost("/", async (
            InsertUserCommand command,
            IValidator<InsertUserCommand> validator,
            ICurrentUserService currentUser,
            InsertUserCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with
            {
                TenantId = currentUser.TenantId,
                LocationId = currentUser.LocationId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToCreated(id => $"api/security/users/{id}");
        });

        group.MapPut("/{userId:int}", async (
            int userId,
            UpdateUserCommand command,
            IValidator<UpdateUserCommand> validator,
            ICurrentUserService currentUser,
            UpdateUserCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with { UserId = userId, TenantId = currentUser.TenantId };
            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });

        group.MapPut("/{userId:int}/set-active", async (
            int userId,
            SetUserActiveCommand command,
            IValidator<SetUserActiveCommand> validator,
            ICurrentUserService currentUser,
            SetUserActiveCommandHandler handler,
            CancellationToken ct) =>
        {
            var request = command with
            {
                UserId = userId,
                TenantId = currentUser.TenantId,
                CurrentUserId = currentUser.UserId
            };

            var invalid = await validator.ValidateEntityAsync(request, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(request, ct);
            return result.ToNoContent();
        });
    }
}
