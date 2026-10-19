using Carter;
using FluentValidation;
using MotelMS.Application.Contracts.Context;
using MotelMS.Application.Features.HR.EmployeePayments.Commands.RecordEmployeePaymentCommand;
using MotelMS.Application.Features.HR.EmployeePayments.Queries.GetEmployeePaymentsQuery;
using MotelMS.WebAPI.Extensions;

namespace MotelMS.WebAPI.Endpoints.HR;

public sealed class EmployeePaymentEndpoints : ICarterModule
{
    public void AddRoutes(IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("api/hr/payments").WithTags("HR.EmployeePayments").RequireAuthorization();

        group.MapGet("/", async (
            ICurrentUserService currentUser,
            GetEmployeePaymentsQueryHandler handler,
            int? employeeId,
            DateTime? from,
            DateTime? to,
            int? page,
            int? pageSize,
            CancellationToken ct) =>
        {
            var query = new GetEmployeePaymentsQuery(
                currentUser.TenantId,
                employeeId,
                from,
                to,
                page ?? 1,
                pageSize ?? 20);
            var result = await handler.HandleAsync(query, ct);
            return result.ToOk();
        })
        .WithName("GetEmployeePayments");

        group.MapPost("/", async (
            RecordEmployeePaymentCommand command,
            IValidator<RecordEmployeePaymentCommand> validator,
            ICurrentUserService currentUser,
            RecordEmployeePaymentCommandHandler handler,
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
            return result.ToCreated(id => $"api/hr/payments/{id}");
        })
        .WithName("RecordEmployeePayment");
    }
}
