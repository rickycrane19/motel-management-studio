using System.Data;
using Dapper;
using Microsoft.Data.SqlClient;
using MotelMS.Application.Contracts.Data;

namespace MotelMS.Infrastructure.Data;

public sealed class SqlServerConnector(ISqlConnectionFactory connectionFactory) : ISqlConnector
{
    private SqlConnection CreateConnection() => (SqlConnection)connectionFactory.CreateConnection();

    public async Task<IEnumerable<T>> QueryAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        return await connection.QueryAsync<T>(new CommandDefinition(spName, parameters, commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<T?> QuerySingleOrDefaultAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        return await connection.QuerySingleOrDefaultAsync<T>(new CommandDefinition(spName, parameters, commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<int> ExecuteAsync(string spName, object? parameters = null, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        return await connection.ExecuteAsync(new CommandDefinition(spName, parameters, commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<T?> ExecuteScalarAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default)
    {
        await using var connection = CreateConnection();
        return await connection.ExecuteScalarAsync<T>(new CommandDefinition(spName, parameters, commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken)).ConfigureAwait(false);
    }

    public async Task<IMultiResult> QueryMultipleAsync(string spName, object? parameters = null, CancellationToken cancellationToken = default)
    {
        var connection = CreateConnection();
        try
        {
            var grid = await connection.QueryMultipleAsync(new CommandDefinition(spName, parameters, commandType: CommandType.StoredProcedure, cancellationToken: cancellationToken)).ConfigureAwait(false);
            return new MultiResult(connection, grid);
        }
        catch
        {
            await connection.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>Wrapper que garantiza la liberación de la conexión y del GridReader.</summary>
    private sealed class MultiResult(SqlConnection connection, SqlMapper.GridReader grid) : IMultiResult
    {
        public Task<T?> ReadSingleOrDefaultAsync<T>() => grid.ReadSingleOrDefaultAsync<T>();

        public Task<T?> ReadFirstOrDefaultAsync<T>() => grid.ReadFirstOrDefaultAsync<T>();

        public async Task<IEnumerable<T>> ReadAsync<T>() => await grid.ReadAsync<T>().ConfigureAwait(false);

        public async ValueTask DisposeAsync()
        {
            await grid.DisposeAsync().ConfigureAwait(false);
            await connection.DisposeAsync().ConfigureAwait(false);
        }
    }
}
