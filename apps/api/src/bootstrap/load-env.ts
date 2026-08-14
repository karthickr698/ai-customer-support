import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';

export function loadLocalEnv(): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(here, '../../../../.env'),
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '../../.env'),
  ];

  const loaded = new Set<string>();
  for (const path of candidates) {
    if (!existsSync(path) || loaded.has(path)) {
      continue;
    }
    loadDotenv({ path });
    loaded.add(path);
  }
}
