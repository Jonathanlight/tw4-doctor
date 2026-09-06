import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the project's browser targets, from `.browserslistrc` or the
 * `browserslist` field of package.json.
 *
 * Deliberately does not resolve queries like `last 2 versions` into concrete
 * versions: that needs caniuse data, changes over time, and would make the
 * report non-reproducible. Explicit floors are what the A4 rule checks.
 */
export async function readBrowserslist(
  root: string,
  packageJson: Record<string, unknown> | null,
): Promise<string[] | null> {
  const rcPath = join(root, '.browserslistrc');
  if (existsSync(rcPath)) {
    const content = await readFile(rcPath, 'utf8');
    const entries = content
      .split('\n')
      .map((line) => line.replace(/#.*$/, '').trim())
      .filter(Boolean);
    if (entries.length > 0) return entries;
  }

  const field = packageJson?.['browserslist'];
  if (Array.isArray(field)) return field.map(String);
  if (typeof field === 'string') return [field];
  if (field && typeof field === 'object') {
    const production = (field as Record<string, unknown>)['production'];
    if (Array.isArray(production)) return production.map(String);
  }

  return null;
}
