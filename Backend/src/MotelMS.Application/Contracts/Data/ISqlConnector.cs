namespace MotelMS.Application.Contracts.Data;

public interface ISqlConnector
{
    Task<IEnumerable<T>> QueryAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default);
    Task<T?> QuerySingleOrDefaultAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default);
    Task<int> ExecuteAsync(string spName, object? parameters = null, CancellationToken cancellationToken = default);
    Task<T?> ExecuteScalarAsync<T>(string spName, object? parameters = null, CancellationToken cancellationToken = default);
    Task<IMultiResult> QueryMultipleAsync(string spName, object? parameters = null, CancellationToken cancellationToken = default);
}
