import { readPath } from './values.js';

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(PLACEHOLDER, (_match, path: string) => {
    const value = readPath(data, path);
    if (value === undefined || value === null) {
      return '';
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  });
}
