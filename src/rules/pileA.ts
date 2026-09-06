import type { Finding, Occurrence, ProjectContext, RuleMeta, ScannedFile } from '../types.js';

/**
 * Pile A — the build will not pass.
 *
 * Unlike pile B these announce themselves, but they announce themselves *after*
 * you have started the migration. Knowing about them beforehand is what turns a
 * two-day job into a two-day estimate.
 */

export const A1: RuleMeta = {
  id: 'A1',
  pile: 'A',
  title: '@apply inside a component style block or CSS module',
  detail:
    'v4 compiles each style block in isolation, so `@apply` no longer sees your ' +
    'theme. Every Vue/Svelte `<style>` and every *.module.css using @apply needs ' +
    'an `@reference "../app.css";` at the top, or the build fails.',
  minutesPerOccurrence: 5,
};

export const A2: RuleMeta = {
  id: 'A2',
  pile: 'A',
  title: 'Sass or SCSS used together with Tailwind',
  detail:
    'v4 is itself the preprocessor and is not designed to run behind Sass. A ' +
    'project mixing the two has to drop Sass from the Tailwind pipeline first. ' +
    'This is usually the single largest item in the estimate.',
  minutesPerOccurrence: 120,
  maxHours: 40,
};

export const A3: RuleMeta = {
  id: 'A3',
  pile: 'A',
  title: 'Config option removed in v4',
  detail:
    '`corePlugins`, `safelist` and `separator` no longer exist. Each needs a ' +
    'different answer, and safelist in particular usually means rethinking how ' +
    'dynamic class names are produced.',
  minutesPerOccurrence: 45,
};

export const A4: RuleMeta = {
  id: 'A4',
  pile: 'A',
  title: 'Browser baseline below what v4 requires',
  detail:
    'v4 depends on @property and color-mix(), so it needs Safari 16.4+, ' +
    'Chrome 111+ and Firefox 128+. Browsers below that get an unstyled page, not ' +
    'a degraded one.',
  minutesPerOccurrence: 0,
};

export const A5: RuleMeta = {
  id: 'A5',
  pile: 'A',
  title: 'Tailwind plugin with no declared v4 support',
  detail:
    'Third-party plugins written against the v3 plugin API do not load in v4. ' +
    'Each needs an upgrade, a replacement, or removal.',
  minutesPerOccurrence: 60,
};

/** Minimum browser versions v4 requires. */
export const V4_BASELINE: Record<string, number> = {
  chrome: 111,
  edge: 111,
  safari: 16.4,
  firefox: 128,
  ios_saf: 16.4,
  opera: 97,
  samsung: 23,
};

const COMPONENT_STYLE_EXTENSIONS = new Set(['.vue', '.svelte', '.astro']);

function isCssModule(path: string): boolean {
  return /\.module\.(css|scss|sass|less)$/.test(path);
}

/**
 * `@apply` in a place where v4 compiles in isolation: a single-file component's
 * style block, or a CSS module.
 */
export function findApplyNeedingReference(files: ScannedFile[]): Occurrence[] {
  const found: Occurrence[] = [];

  for (const file of files) {
    const isComponent = COMPONENT_STYLE_EXTENSIONS.has(file.extension);
    const isModule = isCssModule(file.relativePath);
    if (!isComponent && !isModule) continue;

    // Already fixed: an @reference makes the block compile again.
    if (/@reference\s/.test(file.content)) continue;

    if (isModule) {
      file.content.split('\n').forEach((line, index) => {
        if (/@apply\s/.test(line)) {
          found.push({
            file: file.relativePath,
            line: index + 1,
            snippet: line.trim(),
            note: 'CSS module: add @reference to the block',
          });
        }
      });
      continue;
    }

    // For a single-file component only the <style> blocks matter.
    for (const block of styleBlocks(file.content)) {
      block.content.split('\n').forEach((line, offset) => {
        if (/@apply\s/.test(line)) {
          found.push({
            file: file.relativePath,
            line: block.startLine + offset,
            snippet: line.trim(),
            note: 'component <style>: add @reference to the block',
          });
        }
      });
    }
  }

  return found;
}

/** `<style>` blocks in a single-file component, with the line each starts on. */
export function styleBlocks(source: string): { content: string; startLine: number }[] {
  const blocks: { content: string; startLine: number }[] = [];
  const pattern = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const before = source.slice(0, match.index);
    const startLine = before.split('\n').length;
    blocks.push({ content: match[1] as string, startLine });
  }
  return blocks;
}

const TAILWIND_DIRECTIVE = /@(?:tailwind|apply|layer|config|screen)\b/;

export function findSassWithTailwind(context: ProjectContext): Occurrence[] {
  const deps = allDependencies(context.packageJson);
  const hasSass = ['sass', 'node-sass', 'sass-embedded'].some((d) => d in deps);
  if (!hasSass) return [];

  const offenders = context.files.filter(
    (f) => (f.extension === '.scss' || f.extension === '.sass') && TAILWIND_DIRECTIVE.test(f.content),
  );

  if (offenders.length === 0) {
    // Sass is present but never touches Tailwind: worth a note, not a blocker.
    return [];
  }

  return offenders.map((f) => ({
    file: f.relativePath,
    line: 1,
    snippet: `${f.relativePath} uses Tailwind directives`,
    note: 'Sass is in the dependency list and this file mixes the two',
  }));
}

export const REMOVED_CONFIG_KEYS = ['corePlugins', 'safelist', 'separator'] as const;

export function findRemovedConfigKeys(context: ProjectContext): Occurrence[] {
  const config = context.tailwindConfig;
  if (!config) return [];
  const absolute = context.tailwindConfigPath ?? 'tailwind.config.js';
  // Paths in the report are relative to the project, like every other finding.
  const path = absolute.startsWith(context.root)
    ? absolute.slice(context.root.length + 1)
    : absolute;

  return REMOVED_CONFIG_KEYS.filter((key) => key in config).map((key) => ({
    file: path,
    line: 1,
    snippet: `${key}: …`,
    note: describeRemovedKey(key),
  }));
}

function describeRemovedKey(key: string): string {
  switch (key) {
    case 'corePlugins':
      return 'no replacement; disable utilities by not using them, or override in CSS';
    case 'safelist':
      return 'no replacement; use @source inline(…) or stop building class names dynamically';
    case 'separator':
      return 'no replacement; the variant separator is always ":"';
    default:
      return 'removed in v4';
  }
}

/** Browsers in the project's browserslist that v4 will not support. */
export function findBrowserBaselineGap(context: ProjectContext): Occurrence[] {
  const list = context.browserslist;
  if (!list || list.length === 0) return [];

  const gaps: Occurrence[] = [];
  for (const entry of list) {
    const match = /^\s*(?:(last\s+\d+\s+)?)([a-z_]+)\s*(?:>=?|<=?)?\s*([\d.]+)?/i.exec(entry);
    const browser = match?.[2]?.toLowerCase();
    const version = match?.[3] ? Number.parseFloat(match[3]) : null;
    if (!browser || version === null) continue;
    const minimum = V4_BASELINE[browser];
    if (minimum === undefined) continue;
    if (version < minimum) {
      gaps.push({
        file: 'browserslist',
        line: 1,
        snippet: entry,
        note: `v4 needs ${browser} >= ${minimum}`,
      });
    }
  }
  return gaps;
}

/** Dependency names that are Tailwind plugins. */
export function findTailwindPlugins(context: ProjectContext): Occurrence[] {
  const deps = allDependencies(context.packageJson);

  /** Plugins that were folded into core and no longer exist as packages. */
  const FOLDED_INTO_CORE: Record<string, string> = {
    '@tailwindcss/line-clamp': 'folded into core in v3.3 — remove it, `line-clamp-*` is built in',
    '@tailwindcss/aspect-ratio': 'folded into core — remove it, `aspect-*` is built in',
  };

  const OFFICIAL = new Set([
    '@tailwindcss/typography',
    '@tailwindcss/forms',
    '@tailwindcss/container-queries',
    '@tailwindcss/vite',
    '@tailwindcss/postcss',
    '@tailwindcss/cli',
  ]);

  // Packages carrying "tailwind" in the name that are not Tailwind plugins:
  // Tailwind itself, class-merging helpers, and editor/lint tooling. None of
  // them hook into the plugin API, so none are affected by the v4 rewrite.
  const NOT_PLUGINS = new Set(['tailwindcss', 'tailwind-merge']);
  const TOOLING_PREFIXES = ['eslint-', 'prettier-', 'stylelint-', '@types/'];

  const plugins = Object.keys(deps).filter((name) => {
    if (!name.includes('tailwind')) return false;
    if (NOT_PLUGINS.has(name)) return false;
    return !TOOLING_PREFIXES.some((prefix) => name.startsWith(prefix));
  });

  return plugins.map((name) => ({
    file: 'package.json',
    line: 1,
    snippet: `${name}@${deps[name]}`,
    note:
      FOLDED_INTO_CORE[name] ??
      (OFFICIAL.has(name)
        ? 'official plugin — check for a v4 release'
        : 'third-party plugin — confirm v4 support before migrating'),
  }));
}

function allDependencies(pkg: Record<string, unknown> | null): Record<string, string> {
  if (!pkg) return {};
  return {
    ...((pkg['dependencies'] as Record<string, string>) ?? {}),
    ...((pkg['devDependencies'] as Record<string, string>) ?? {}),
  };
}

export function runPileA(context: ProjectContext): Finding[] {
  const findings: Finding[] = [
    { rule: A1, occurrences: findApplyNeedingReference(context.files) },
    { rule: A2, occurrences: findSassWithTailwind(context) },
    { rule: A3, occurrences: findRemovedConfigKeys(context) },
    { rule: A4, occurrences: findBrowserBaselineGap(context) },
    { rule: A5, occurrences: findTailwindPlugins(context) },
  ];
  return findings.filter((f) => f.occurrences.length > 0);
}
