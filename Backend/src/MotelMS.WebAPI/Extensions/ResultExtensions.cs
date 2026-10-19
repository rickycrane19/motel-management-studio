using FluentValidation;
using MotelMS.Domain.Common;

namespace MotelMS.WebAPI.Extensions;

/// <summary>
/// Traduce el patrón <see cref="Result"/> / <see cref="Result{T}"/> de la capa de
/// aplicación a respuestas HTTP (<c>IResult</c>) con ProblemDetails y código de error.
/// </summary>
public static class ResultExtensions
{
    public static IResult ToProblemDetails(this Error error)
    {
        var statusCode = error.Type switch
        {
            ErrorType.Validation => StatusCodes.Status400BadRequest,
            ErrorType.NotFound => StatusCodes.Status404NotFound,
            ErrorType.Conflict => StatusCodes.Status409Conflict,
            ErrorType.Unauthorized => StatusCodes.Status401Unauthorized,
            ErrorType.Forbidden => StatusCodes.Status403Forbidden,
            ErrorType.UnprocessableEntity => StatusCodes.Status422UnprocessableEntity,
            _ => StatusCodes.Status500InternalServerError
        };

        return Results.Problem(
            detail: error.Message,
            statusCode: statusCode,
            title: error.Type.ToString(),
            extensions: new Dictionary<string, object?> { ["errorCode"] = error.Code });
    }

    /// <summary>Ejecuta <paramref name="onSuccess"/> si el resultado es exitoso, o devuelve el problema.</summary>
    public static IResult Match(this Result result, Func<IResult> onSuccess)
        => result.IsSuccess ? onSuccess() : result.Error!.ToProblemDetails();

    public static IResult Match<T>(this Result<T> result, Func<T, IResult> onSuccess)
        => result.IsSuccess ? onSuccess(result.Value) : result.Error!.ToProblemDetails();

    /// <summary>200 OK con el valor del resultado.</summary>
    public static IResult ToOk<T>(this Result<T> result)
        => result.Match(value => Results.Ok(value));

    /// <summary>200 OK con cuerpo vacío.</summary>
    public static IResult ToOk(this Result result)
        => result.Match(() => Results.Ok());

    /// <summary>201 Created con el valor y la ubicación indicada.</summary>
    public static IResult ToCreated<T>(this Result<T> result, Func<T, string> locationFactory)
        => result.Match(value => Results.Created(locationFactory(value), value));

    /// <summary>204 No Content para comandos sin cuerpo de respuesta.</summary>
    public static IResult ToNoContent(this Result result)
        => result.Match(() => Results.NoContent());

    /// <summary>Valida el request y devuelve un 400 ProblemDetails si falla, o null si es válido.</summary>
    public static async Task<IResult?> ValidateEntityAsync<T>(
        this IValidator<T>? validator,
        T instance,
        CancellationToken cancellationToken = default)
    {
        if (validator is null)
            return null;

        var validation = await validator.ValidateAsync(instance, cancellationToken);
        if (validation.IsValid)
            return null;

        var message = string.Join(" ", validation.Errors.Select(e => e.ErrorMessage));
        return Error.Validation(message, "Validation.InvalidRequest").ToProblemDetails();
    }

    /// <summary>Devuelve 404 NotFound estándar.</summary>
    public static IResult NotFound(string message)
        => Error.NotFound(message).ToProblemDetails();
}
