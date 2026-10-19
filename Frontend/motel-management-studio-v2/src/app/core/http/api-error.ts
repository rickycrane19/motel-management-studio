import { HttpErrorResponse } from '@angular/common/http';

interface ProblemDetails {
  readonly title?: string;
  readonly detail?: string;
  readonly message?: string;
  readonly errors?: Readonly<Record<string, readonly string[]>>;
}

function firstValidationMessage(problem: ProblemDetails): string | null {
  if (!problem.errors) {
    return null;
  }

  for (const messages of Object.values(problem.errors)) {
    if (messages.length > 0) {
      return messages[0] ?? null;
    }
  }

  return null;
}

/** Permite reconocer un fallo conocido sin mostrar detalles internos del servidor. */
export function matchesApiErrorDetail(error: unknown, pattern: RegExp): boolean {
  if (!(error instanceof HttpErrorResponse)) return false;
  const problem = error.error;
  const detail = typeof problem === 'object' && problem !== null
    ? (problem as ProblemDetails).detail
    : undefined;
  return typeof detail === 'string' && pattern.test(detail);
}

/**
 * Los mensajes de validación del servidor se muestran tal cual solo si están escritos para personas;
 * los que delatan la implementación (procedimientos, excepciones, identificadores internos) se
 * sustituyen por un texto comprensible según el código de respuesta.
 */
const TECHNICAL_MESSAGE = /\b(usp\w*|SP|SQL|stored procedure|exception|stack|null reference|object reference|TenantId|LocationId|UserId|JWT|token|endpoint|payload|DTO|JSON|V2|backend|API|HTTP|constraint|FOREIGN KEY|duplicate key|deadlock|timeout expired)\b/i;

export function isHumanMessage(message: string | null | undefined): message is string {
  return typeof message === 'string' && message.trim().length > 0 && message.length <= 280 && !TECHNICAL_MESSAGE.test(message);
}

export function describeApiError(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'No fue posible completar la operación. Inténtalo de nuevo.';
  }

  if (error.status === 0) {
    return 'No hay conexión con el servidor. Revisa tu red e inténtalo de nuevo.';
  }

  if (error.status >= 500) {
    return 'El sistema no pudo completar la operación en este momento. Inténtalo de nuevo en unos minutos; si persiste, avisa al administrador.';
  }

  const problem =
    typeof error.error === 'object' && error.error !== null
      ? (error.error as ProblemDetails)
      : undefined;
  const serverMessage = problem
    ? firstValidationMessage(problem) ?? problem.detail ?? problem.message ?? problem.title
    : undefined;

  if (isHumanMessage(serverMessage) && !/^(Bad Request|Not Found|Conflict|Forbidden|Unauthorized|One or more validation errors occurred\.?)$/i.test(serverMessage.trim())) {
    return serverMessage;
  }

  switch (error.status) {
    case 401:
      return 'Tu sesión terminó. Vuelve a iniciar sesión para continuar.';
    case 403:
      return 'Tu rol no tiene permiso para realizar esta acción. Pide acceso a un administrador.';
    case 404:
      return 'No encontramos ese registro. Es posible que se haya eliminado o pertenezca a otra sucursal.';
    case 409:
    case 422:
      return 'No se pudo guardar porque los datos cambiaron o incumplen una regla del negocio. Actualiza la vista e inténtalo otra vez.';
    case 429:
      return 'Demasiados intentos seguidos. Espera unos segundos e inténtalo de nuevo.';
    default:
      return 'No se pudo completar la operación. Revisa los datos e inténtalo de nuevo.';
  }
}
