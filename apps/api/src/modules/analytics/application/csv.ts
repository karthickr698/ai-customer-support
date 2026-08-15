function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  const raw = String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function encodeCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
