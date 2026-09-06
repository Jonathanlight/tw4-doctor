import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const CANDIDATES = [
  'tailwind.config.ts',
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
];

export interface LoadedConfig {
  config: Record<string, unknown> | null;
  path: string | null;
  /** Set when the config was found but could not be evaluated. */
  error?: string;
}

/**
 * Loads `tailwind.config.*`.
 *
 * Evaluating the config is the accurate way to read it — a config can compute its
 * own keys — so `jiti` is used to run TypeScript and ESM configs directly. But a
 * project mid-upgrade often has a config that no longer evaluates, and refusing
 * to report anything in that case would be useless. So evaluation failure falls
 * back to reading the source text and detecting the removed keys by name.
 */
export async function loadTailwindConfig(root: string): Promise<LoadedConfig> {
  const found = CANDIDATES.map((name) => join(root, name)).find((p) => existsSync(p));
  if (!found) return { config: null, path: null };

  try {
    const { createJiti } = await import('jiti');
    const jiti = createJiti(root, { interopDefault: true, moduleCache: false });
    const loaded = (await jiti.import(found, { default: true })) as Record<string, unknown>;
    if (loaded && typeof loaded === 'object') {
      return { config: loaded, path: found };
    }
  } catch (error) {
    const textual = await parseConfigTextually(found);
    return {
      config: textual,
      path: found,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const textual = await parseConfigTextually(found);
  return { config: textual, path: found };
}

/**
 * Last resort: find the top-level keys by reading the file as text. Only used to
 * answer "is this key present", which is all the A3 rule needs.
 */
export async function parseConfigTextually(
  path: string,
): Promise<Record<string, unknown> | null> {
  try {
    const source = await readFile(path, 'utf8');
    const config: Record<string, unknown> = {};
    for (const key of ['corePlugins', 'safelist', 'separator', 'plugins', 'content', 'theme']) {
      if (new RegExp(`(^|[\\s,{])${key}\\s*:`, 'm').test(source)) {
        config[key] = '(detected in source; config could not be evaluated)';
      }
    }
    return Object.keys(config).length > 0 ? config : null;
  } catch {
    return null;
  }
}
