import type { ClassString, Finding, Occurrence, RuleMeta } from '../types.js';
import { baseUtility } from './pileB.js';

/**
 * Pile C — mechanical syntax changes.
 *
 * `@tailwindcss/upgrade` handles all of this. It is counted here anyway, because
 * the number of occurrences is what turns "we should migrate at some point" into
 * a figure you can put in a quote.
 */

export const C1: RuleMeta = {
  id: 'C1',
  pile: 'C',
  title: 'Important prefix moved to a suffix',
  detail: '`!flex` becomes `flex!`.',
  minutesPerOccurrence: 0.2,
};

export const C2: RuleMeta = {
  id: 'C2',
  pile: 'C',
  title: 'CSS variable shorthand changed brackets',
  detail: '`bg-[--brand]` becomes `bg-(--brand)`.',
  minutesPerOccurrence: 0.3,
};

export const C3: RuleMeta = {
  id: 'C3',
  pile: 'C',
  title: 'Commas in arbitrary values became underscores',
  detail: '`grid-cols-[max-content,auto]` becomes `grid-cols-[max-content_auto]`.',
  minutesPerOccurrence: 0.5,
};

export const C4: RuleMeta = {
  id: 'C4',
  pile: 'C',
  title: '@tailwind directives replaced by a single import',
  detail: '`@tailwind base/components/utilities` becomes `@import "tailwindcss"`.',
  minutesPerOccurrence: 2,
};

export const C5: RuleMeta = {
  id: 'C5',
  pile: 'C',
  title: 'Custom utilities moved from @layer to @utility',
  detail: '`@layer utilities { .x {} }` becomes `@utility x {}`.',
  minutesPerOccurrence: 3,
};

export const C6: RuleMeta = {
  id: 'C6',
  pile: 'C',
  title: 'Renamed utilities',
  detail:
    'The scale shifted so that the bare name is the default: shadow-sm -> shadow-xs, ' +
    'shadow -> shadow-sm, and the same for drop-shadow, blur, backdrop-blur and rounded. ' +
    'Also outline-none -> outline-hidden and ring -> ring-3.',
  minutesPerOccurrence: 0.3,
};

export const C7: RuleMeta = {
  id: 'C7',
  pile: 'C',
  title: 'Removed utilities',
  detail:
    'bg-opacity-*/text-opacity-*/border-opacity-* become the `/50` modifier; ' +
    'flex-shrink-* -> shrink-*, flex-grow-* -> grow-*, overflow-ellipsis -> ' +
    'text-ellipsis, decoration-slice/clone -> box-decoration-*.',
  minutesPerOccurrence: 0.5,
};

export const C8: RuleMeta = {
  id: 'C8',
  pile: 'C',
  title: 'Stacked variants now read left to right',
  detail:
    'Variant order reversed. Any class with three or more stacked variants should ' +
    'be re-read by hand — the upgrade tool cannot know which order you meant.',
  minutesPerOccurrence: 4,
};

/** Utilities renamed in v4, old name to new name. */
export const RENAMED_UTILITIES: Record<string, string> = {
  'shadow-sm': 'shadow-xs',
  shadow: 'shadow-sm',
  'drop-shadow-sm': 'drop-shadow-xs',
  'drop-shadow': 'drop-shadow-sm',
  'blur-sm': 'blur-xs',
  blur: 'blur-sm',
  'backdrop-blur-sm': 'backdrop-blur-xs',
  'backdrop-blur': 'backdrop-blur-sm',
  'rounded-sm': 'rounded-xs',
  rounded: 'rounded-sm',
  'outline-none': 'outline-hidden',
  ring: 'ring-3',
};

/** Utilities removed in v4, with what replaces them. */
export const REMOVED_UTILITIES: { pattern: RegExp; replacement: string }[] = [
  { pattern: /^bg-opacity-(\d+)$/, replacement: 'the /<opacity> modifier on bg-*' },
  { pattern: /^text-opacity-(\d+)$/, replacement: 'the /<opacity> modifier on text-*' },
  { pattern: /^border-opacity-(\d+)$/, replacement: 'the /<opacity> modifier on border-*' },
  { pattern: /^divide-opacity-(\d+)$/, replacement: 'the /<opacity> modifier on divide-*' },
  { pattern: /^ring-opacity-(\d+)$/, replacement: 'the /<opacity> modifier on ring-*' },
  { pattern: /^placeholder-opacity-(\d+)$/, replacement: 'the /<opacity> modifier' },
  { pattern: /^flex-shrink(-.*)?$/, replacement: 'shrink-*' },
  { pattern: /^flex-grow(-.*)?$/, replacement: 'grow-*' },
  { pattern: /^overflow-ellipsis$/, replacement: 'text-ellipsis' },
  { pattern: /^decoration-slice$/, replacement: 'box-decoration-slice' },
  { pattern: /^decoration-clone$/, replacement: 'box-decoration-clone' },
];

function occurrence(c: ClassString, note: string): Occurrence {
  return {
    file: c.file,
    line: c.line,
    snippet: c.value.length > 100 ? `${c.value.slice(0, 97)}…` : c.value,
    note,
  };
}

export function findImportantPrefix(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    // `!flex` and `hover:!flex`; the marker sits after any variants.
    const hits = c.tokens.filter((t) => /(?:^|:)!/.test(t));
    if (hits.length === 0) continue;
    found.push(occurrence(c, hits.map((h) => `${h} -> ${h.replace(/(^|:)!/, '$1')}!`).join(', ')));
  }
  return found;
}

export function findBracketVariableShorthand(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const hits = c.tokens.filter((t) => /\[--[\w-]+\]/.test(t));
    if (hits.length === 0) continue;
    found.push(
      occurrence(c, hits.map((h) => `${h} -> ${h.replace(/\[(--[\w-]+)\]/, '($1)')}`).join(', ')),
    );
  }
  return found;
}

export function findCommasInArbitraryValues(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    // Commas inside a function call within the value are fine; a bare comma
    // separating values is what changed.
    const hits = c.tokens.filter((t) => {
      const match = /\[([^\]]*)\]/.exec(t);
      if (!match) return false;
      const inner = match[1] as string;
      const withoutCalls = inner.replace(/\w+\([^)]*\)/g, '');
      return withoutCalls.includes(',');
    });
    if (hits.length === 0) continue;
    found.push(occurrence(c, hits.join(', ')));
  }
  return found;
}

export function findRenamedUtilities(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const hits: string[] = [];
    for (const token of c.tokens) {
      const base = baseUtility(token);
      const renamed = RENAMED_UTILITIES[base];
      if (renamed) hits.push(`${base} -> ${renamed}`);
    }
    if (hits.length === 0) continue;
    found.push(occurrence(c, [...new Set(hits)].join(', ')));
  }
  return found;
}

export function findRemovedUtilities(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const hits: string[] = [];
    for (const token of c.tokens) {
      const base = baseUtility(token);
      for (const { pattern, replacement } of REMOVED_UTILITIES) {
        if (pattern.test(base)) hits.push(`${base} -> ${replacement}`);
      }
    }
    if (hits.length === 0) continue;
    found.push(occurrence(c, [...new Set(hits)].join(', ')));
  }
  return found;
}

export function findDeeplyStackedVariants(classStrings: ClassString[], minimum = 3): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const hits = c.tokens.filter((t) => {
      const parts = t.replace(/^!/, '').split(':');
      // Arbitrary variants contain colons of their own; only count real ones.
      return parts.length - 1 >= minimum && !t.includes('[');
    });
    if (hits.length === 0) continue;
    found.push(occurrence(c, hits.join(', ')));
  }
  return found;
}

/** CSS-level changes, found in stylesheet sources rather than class lists. */
export function findCssDirectives(
  files: { relativePath: string; content: string }[],
): { c4: Occurrence[]; c5: Occurrence[] } {
  const c4: Occurrence[] = [];
  const c5: Occurrence[] = [];

  for (const file of files) {
    const lines = file.content.split('\n');
    lines.forEach((line, index) => {
      if (/@tailwind\s+(base|components|utilities|screens|variants)/.test(line)) {
        c4.push({
          file: file.relativePath,
          line: index + 1,
          snippet: line.trim(),
          note: 'replace with @import "tailwindcss"',
        });
      }
      if (/@layer\s+utilities\b/.test(line)) {
        c5.push({
          file: file.relativePath,
          line: index + 1,
          snippet: line.trim(),
          note: 'each utility inside becomes its own @utility block',
        });
      }
    });
  }

  return { c4, c5 };
}

export function runPileC(
  classStrings: ClassString[],
  cssFiles: { relativePath: string; content: string }[],
): Finding[] {
  const css = findCssDirectives(cssFiles);
  const findings: Finding[] = [
    { rule: C1, occurrences: findImportantPrefix(classStrings) },
    { rule: C2, occurrences: findBracketVariableShorthand(classStrings) },
    { rule: C3, occurrences: findCommasInArbitraryValues(classStrings) },
    { rule: C4, occurrences: css.c4 },
    { rule: C5, occurrences: css.c5 },
    { rule: C6, occurrences: findRenamedUtilities(classStrings) },
    { rule: C7, occurrences: findRemovedUtilities(classStrings) },
    { rule: C8, occurrences: findDeeplyStackedVariants(classStrings) },
  ];
  return findings.filter((f) => f.occurrences.length > 0);
}
