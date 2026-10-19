using Microsoft.Data.SqlClient;
using MotelMS.Domain.Common;

namespace MotelMS.Application.Common.Data;

public static class SqlExceptionMapper
{
    public static string HumanMessage(SqlException ex) => ex.Number switch
    {
        >= 50000 => ex.Message,
        2627 or 2601 => "Ya existe un registro con esos mismos datos (clave única duplicada).",
        547 => "No se pudo completar la operación debido a una restricción de clave foránea o regla referencial.",
        515 or 245 or 8114 or 8115 or 8144 or 242 or 241 => "Falta un dato obligatorio o tiene un formato numérico o de fecha incorrecto.",
        1205 or 1204 => "Conflicto de concurrencia en la base de datos (deadlock). Inténtalo de nuevo en unos momentos.",
        _ => "Ocurrió un error inesperado al procesar la solicitud en el servidor."
    };

    public static Result MapToResult(this SqlException ex)
    {
        return ex.Number switch
        {
            50400 => Result.Failure(Error.Validation(ex.Message, "Database.BadRequest")),
            50401 => Result.Failure(Error.Unauthorized(ex.Message, "Authentication.Unauthorized")),
            50403 => Result.Failure(Error.Forbidden(ex.Message, "Authorization.Forbidden")),
            50404 => Result.Failure(Error.NotFound(ex.Message, "Database.NotFound")),
            50409 => Result.Failure(Error.Conflict(ex.Message, "Database.Conflict")),
            50422 => Result.Failure(Error.UnprocessableEntity(ex.Message, "Database.UnprocessableEntity")),
            2627 or 2601 => Result.Failure(Error.Conflict(HumanMessage(ex), "Database.UniqueConstraint")),
            547 or 515 or 245 => Result.Failure(Error.Validation(HumanMessage(ex), "Database.ValidationError")),
            1205 or 1204 => Result.Failure(Error.Conflict(HumanMessage(ex), "Database.Deadlock")),
            _ => Result.Failure(Error.Failure(HumanMessage(ex), "Database.UnexpectedError"))
        };
    }

    public static Result<T> MapToResult<T>(this SqlException ex)
    {
        return ex.Number switch
        {
            50400 => Result<T>.Failure(Error.Validation(ex.Message, "Database.BadRequest")),
            50401 => Result<T>.Failure(Error.Unauthorized(ex.Message, "Authentication.Unauthorized")),
            50403 => Result<T>.Failure(Error.Forbidden(ex.Message, "Authorization.Forbidden")),
            50404 => Result<T>.Failure(Error.NotFound(ex.Message, "Database.NotFound")),
            50409 => Result<T>.Failure(Error.Conflict(ex.Message, "Database.Conflict")),
            50422 => Result<T>.Failure(Error.UnprocessableEntity(ex.Message, "Database.UnprocessableEntity")),
            2627 or 2601 => Result<T>.Failure(Error.Conflict(HumanMessage(ex), "Database.UniqueConstraint")),
            547 or 515 or 245 => Result<T>.Failure(Error.Validation(HumanMessage(ex), "Database.ValidationError")),
            1205 or 1204 => Result<T>.Failure(Error.Conflict(HumanMessage(ex), "Database.Deadlock")),
            _ => Result<T>.Failure(Error.Failure(HumanMessage(ex), "Database.UnexpectedError"))
        };
    }
}
