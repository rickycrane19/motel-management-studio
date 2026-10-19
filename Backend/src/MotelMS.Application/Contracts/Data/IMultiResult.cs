namespace MotelMS.Application.Contracts.Data;

/// <summary>
/// Lector de resultados múltiples (múltiples result sets) devuelto por
/// un procedimiento almacenado. Debe disponerse al finalizar su lectura.
/// </summary>
public interface IMultiResult : IAsyncDisposable
{
    /// <summary>Lee un único registro o null si el result set viene vacío.</summary>
    Task<T?> ReadSingleOrDefaultAsync<T>();

    /// <summary>Lee el primer registro del result set o null si viene vacío.</summary>
    Task<T?> ReadFirstOrDefaultAsync<T>();

    /// <summary>Lee la totalidad de las filas del result set actual.</summary>
    Task<IEnumerable<T>> ReadAsync<T>();
}
