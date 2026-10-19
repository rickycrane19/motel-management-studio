using Carter;
using FluentValidation;
using MotelMS.Application.Features.Security.Auth.Commands.LoginCommand;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.Security;

public sealed class AuthEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/auth").WithTags("Security.Auth");

        group.MapPost("/login", async Task<IResult> (
            LoginCommand command,
            IValidator<LoginCommand> validator,
            LoginCommandHandler handler,
            CancellationToken ct) =>
        {
            var invalid = await validator.ValidateEntityAsync(command, ct);
            if (invalid is not null)
                return invalid;

            var result = await handler.HandleAsync(command, ct);
            return result.ToOk();
        })
        .AllowAnonymous()
        .WithName("Login");
    }
}
