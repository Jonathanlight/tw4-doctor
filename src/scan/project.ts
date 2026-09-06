import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { glob } from 'tinyglobby';
import { extractApplyDirectives, extractClassStrings, styleBlocksOf } from './extract.js';
import { loadTailwindConfig } from '../config/tailwindConfig.js';
import { readBrowserslist } from '../config/browserslist.js';
import type { ProjectContext, ScannedFile } from '../types.js';

/** Extensions that can hold class names. */
export const MARKUP_EXTENSIONS = [
  '.html',
  '.htm',
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.astro',
  '.php',
  '.twig',
  '.erb',
  '.hbs',
  '.mdx',
];

export const STYLE_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.pcss', '.postcss'];

const IGNORED = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.nuxt/**',
  '**/.output/**',
  '**/.svelte-kit/**',
  '**/coverage/**',
  '**/vendor/**',
  '**/*.min.js',
  '**/*.min.css',
];

export interface ScanOptions {
  /** Extra glob patterns to ignore. */
  ignore?: string[];
  /** Skip class lists found in bare string constants. */
  noBareLiterals?: boolean;
}

/**
 * Reads a project into everything the rules need: its files, every class list in
 * them, its package.json, its Tailwind config and its browser baseline.
 *
 * Nothing here imports Tailwind. The project being audited is usually mid-upgrade
 * and may not have a working install, which is exactly when you want to run this.
 */
export async function scanProject(
  root: string,
  options: ScanOptions = {},
): Promise<ProjectContext> {
  const absoluteRoot = resolve(root);
  const extensions = [...MARKUP_EXTENSIONS, ...STYLE_EXTENSIONS];

  const paths = await glob(
    extensions.map((ext) => `**/*${ext}`),
    {
      cwd: absoluteRoot,
      absolute: true,
      ignore: [...IGNORED, ...(options.ignore ?? [])],
      dot: false,
    },
  );

  const files: ScannedFile[] = [];
  for (const path of paths.sort()) {
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    files.push({
      path,
      relativePath: relative(absoluteRoot, path),
      extension: extname(path),
      content,
    });
  }

  const classStrings = files.flatMap((file) => {
    if (STYLE_EXTENSIONS.includes(file.extension)) {
      return extractApplyDirectives(file.content, file.relativePath);
    }
    const strings = extractClassStrings(file.content, file.relativePath, {
      includeBareLiterals: !options.noBareLiterals,
    });
    // Single-file components can carry @apply in their style block too.
    const inStyle = styleBlocksOf(file.content).flatMap((block) =>
      extractApplyDirectives(block.content, file.relativePath).map((c) => ({
        ...c,
        line: c.line + block.startLine - 1,
      })),
    );
    return [...strings, ...inStyle];
  });

  const packageJson = await readJson(join(absoluteRoot, 'package.json'));
  const config = await loadTailwindConfig(absoluteRoot);
  const browserslist = await readBrowserslist(absoluteRoot, packageJson);

  return {
    root: absoluteRoot,
    files,
    classStrings,
    packageJson,
    tailwindConfig: config.config,
    tailwindConfigPath: config.path,
    browserslist,
  };
}

async function readJson(path: string): Promise<Record<string, unknown> | null> {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}
