namespace MotelMS.Domain.Common;

public enum ErrorType
{
    Failure = 0,
    Validation = 1,
    NotFound = 2,
    Conflict = 3,
    Unauthorized = 4,
    Forbidden = 5,
    UnprocessableEntity = 6
}

public sealed record Error(string Code, string Message, ErrorType Type = ErrorType.Failure)
{
    public static readonly Error None = new(string.Empty, string.Empty);
    public static Error Failure(string message, string code = "General.Failure") => new(code, message, ErrorType.Failure);
    public static Error Validation(string message, string code = "Validation.Error") => new(code, message, ErrorType.Validation);
    public static Error NotFound(string message, string code = "Resource.NotFound") => new(code, message, ErrorType.NotFound);
    public static Error Conflict(string message, string code = "Resource.Conflict") => new(code, message, ErrorType.Conflict);
    public static Error Unauthorized(string message, string code = "Auth.Unauthorized") => new(code, message, ErrorType.Unauthorized);
    public static Error Forbidden(string message, string code = "Auth.Forbidden") => new(code, message, ErrorType.Forbidden);
    public static Error UnprocessableEntity(string message, string code = "Business.RuleViolation") => new(code, message, ErrorType.UnprocessableEntity);
}
