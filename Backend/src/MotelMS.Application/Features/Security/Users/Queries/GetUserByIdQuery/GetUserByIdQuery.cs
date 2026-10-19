using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Application.Features.Security.Users.Queries.GetUsersQuery;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Users.Queries.GetUserByIdQuery;

public sealed record GetUserByIdQuery(Guid TenantId, int UserId);

public sealed class GetUserByIdQueryHandler(ISqlConnector connector)
{
    public async Task<Result<UserDto>> HandleAsync(GetUserByIdQuery query, CancellationToken cancellationToken = default)
    {
        var result = await QueryRunner.QuerySingleOrDefaultAsync<UserDto>(
            connector,
            "[Security].[uspGetUserById]",
            new { query.TenantId, query.UserId },
            cancellationToken);

        if (result.IsFailure)
            return Result<UserDto>.Failure(result.Error!);

        return result.Value is null
            ? Result<UserDto>.Failure(Error.NotFound("El usuario no fue encontrado."))
            : Result<UserDto>.Success(result.Value);
    }
}
