using System.Data;
using Dapper;
using MotelMS.Application.Common.Data;
using MotelMS.Application.Contracts.Data;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Features.Security.Users.Queries.GetUsersQuery;

public sealed record UserDto
{
    public int UserId { get; init; }
    public Guid TenantId { get; init; }
    public Guid? LocationId { get; init; }
    public string Username { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string Role { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public DateTime CreatedOn { get; init; }
}

/// <summary>Contadores del tenant para las tarjetas de resumen del listado de usuarios.</summary>
public sealed record UserStatsDto(
    int Total,
    int Active,
    int Roles);

/// <summary>Página del listado de usuarios: solo la ventana pedida + el total para paginar.</summary>
public sealed record UserPageDto(
    IReadOnlyList<UserDto> Items,
    int TotalRecords,
    int Page,
    int PageSize,
    UserStatsDto Stats);

public sealed record GetUsersQuery(
    Guid TenantId,
    string? Search = null,
    bool? OnlyActive = null,
    string? Role = null,
    int Page = 1,
    int PageSize = 20);

public sealed class GetUsersQueryHandler(ISqlConnector connector)
{
    public async Task<Result<UserPageDto>> HandleAsync(GetUsersQuery query, CancellationToken cancellationToken = default)
    {
        var page = query.Page < 1 ? 1 : query.Page;
        var pageSize = query.PageSize switch
        {
            < 1 => 20,
            > 200 => 200,
            _ => query.PageSize
        };

        var parameters = new DynamicParameters();
        parameters.Add("@TenantId", query.TenantId);
        parameters.Add("@Search", string.IsNullOrWhiteSpace(query.Search) ? null : query.Search.Trim());
        parameters.Add("@OnlyActive", query.OnlyActive);
        parameters.Add("@Role", string.IsNullOrWhiteSpace(query.Role) ? null : query.Role.Trim());
        parameters.Add("@Page", page);
        parameters.Add("@PageSize", pageSize);
        parameters.Add("@TotalRecords", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@TotalCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@ActiveCount", dbType: DbType.Int32, direction: ParameterDirection.Output);
        parameters.Add("@RoleCount", dbType: DbType.Int32, direction: ParameterDirection.Output);

        var result = await QueryRunner.QueryAsync<UserDto>(
            connector,
            "[Security].[uspGetUsers]",
            parameters,
            cancellationToken);

        if (result.IsFailure)
            return Result<UserPageDto>.Failure(result.Error!);

        var total = parameters.Get<int?>("@TotalRecords") ?? 0;
        var stats = new UserStatsDto(
            parameters.Get<int?>("@TotalCount") ?? 0,
            parameters.Get<int?>("@ActiveCount") ?? 0,
            parameters.Get<int?>("@RoleCount") ?? 0);

        return Result<UserPageDto>.Success(
            new UserPageDto(result.Value.ToList(), total, page, pageSize, stats));
    }
}
