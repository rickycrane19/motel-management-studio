using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.HR.Employees.Queries.GetEmployeeStatsQuery;

/// <summary>Contadores del directorio para las tarjetas de resumen (sin traer los registros).</summary>
public sealed record EmployeeStatsDto
{
    public int TotalEmployees { get; init; }
    public int ActiveEmployees { get; init; }
    public int InactiveEmployees { get; init; }
}

public sealed record GetEmployeeStatsQuery(Guid TenantId);

public sealed class GetEmployeeStatsQueryHandler(ISqlConnector connector)
{
    public async Task<Result<EmployeeStatsDto>> HandleAsync(GetEmployeeStatsQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QuerySingleOrDefaultAsync<EmployeeStatsDto>(
            connector,
            "[HR].[uspGetEmployeeStats]",
            new { query.TenantId },
            cancellationToken);

        if (result.IsFailure)
            return Result<EmployeeStatsDto>.Failure(result.Error!);

        return Result<EmployeeStatsDto>.Success(result.Value ?? new EmployeeStatsDto());
    }
}
