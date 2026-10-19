export function dateKeyInTimeZone(value: Date, timeZone: string | null | undefined): string {
  const configuredTimeZone = timeZone?.trim() || 'UTC';
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatDateParts(value, configuredTimeZone);
  } catch {
    parts = formatDateParts(value, 'UTC');
  }

  const read = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function formatInstantInTimeZone(
  value: string | Date,
  timeZone: string | null | undefined,
  style: 'short' | 'medium' | 'time' = 'short',
): string {
  const date = value instanceof Date ? value : new Date(normalizeUtcInstant(value));
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  const configuredTimeZone = timeZone?.trim() || 'UTC';
  const options: Intl.DateTimeFormatOptions = style === 'time'
    ? { timeZone: configuredTimeZone, hour: 'numeric', minute: '2-digit' }
    : { timeZone: configuredTimeZone, dateStyle: style, timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat('es-NI', options).format(date);
  } catch {
    return new Intl.DateTimeFormat('es-NI', { ...options, timeZone: 'UTC' }).format(date);
  }
}

function normalizeUtcInstant(value: string): string {
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed)
    ? `${trimmed}Z`
    : trimmed;
}

function formatDateParts(value: Date, timeZone: string): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
}

/**
 * Instante UTC en que empieza el día `dateKey` (AAAA-MM-DD) en la zona horaria de la sucursal.
 * Sirve para mandar al servidor rangos [desde, hasta) de «días completos» del negocio.
 */
export function startOfLocalDayUtc(dateKey: string, timeZone: string | null | undefined): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const configuredTimeZone = timeZone?.trim() || 'UTC';
  const first = utcGuess - zoneOffsetMs(new Date(utcGuess), configuredTimeZone);
  const second = utcGuess - zoneOffsetMs(new Date(first), configuredTimeZone);
  return new Date(second);
}

/** Primer instante UTC del día siguiente a `dateKey` en la zona de la sucursal (límite exclusivo de un rango de días). */
export function startOfNextLocalDayUtc(dateKey: string, timeZone: string | null | undefined): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const key = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
  return startOfLocalDayUtc(key, timeZone);
}

function zoneOffsetMs(date: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date);
  } catch {
    return 0;
  }
  const read = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), read('hour'), read('minute'), read('second'));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
