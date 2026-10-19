export type CsvValue = string | number | boolean | null | undefined;

function csvCell(value: CsvValue): string {
  const text = value == null ? '' : String(value);
  // Spreadsheet applications may execute cells that begin with a formula marker.
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function csvDocument(rows: readonly (readonly CsvValue[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
}
