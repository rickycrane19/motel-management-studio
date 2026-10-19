using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Features.HR.Employees.Queries.GetEmployeesQuery;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.Employees.Queries.GetEmployeeByIdQuery;

public sealed record GetEmployeeByIdQuery(Guid TenantId, int EmployeeId);

public sealed class GetEmployeeByIdQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeeDto?>> HandleAsync(GetEmployeeByIdQuery query, CancellationToken cancellationToken = default)
    {
        return await QueryRunner.QuerySingleOrDefaultAsync<EmployeeDto>(
            connector,
            "[HR].[uspGetEmployeeById]",
            new { query.TenantId, query.EmployeeId },
            cancellationToken);
    }
}
