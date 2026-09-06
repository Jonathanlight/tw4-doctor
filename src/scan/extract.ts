import type { ClassString } from '../types.js';

/**
 * Pulling Tailwind classes out of source is the hard part of this tool, and a
 * naive regex over the whole file is the wrong answer: it finds `border` inside
 * prose, inside imports, inside anything.
 *
 * The approach here is to find *string literals* and then decide, from the few
 * characters in front of each one, whether that literal is a class list. That
 * covers the shapes classes actually appear in — `class=`, `className=`, Vue's
 * `:class`, and the `clsx`/`cn`/`classnames`/`twMerge` family — while ignoring
 * every other string in the file.
 *
 * Template literals are handled by taking their static chunks and dropping the
 * `${...}` holes, because a class list built by interpolation still has real
 * utilities either side of the hole.
 */

/** Helpers whose string arguments are class lists. */
const CLASS_HELPERS = [
  'clsx',
  'cn',
  'classnames',
  'classNames',
  'twMerge',
  'twJoin',
  'tw',
  'cva',
  'tv',
];

/** Attributes whose value is a class list, across the templating languages. */
const CLASS_ATTRIBUTES = [
  'class',
  'className',
  'classList',
  'class:list',
  ':class',
  'v-bind:class',
  'activeClassName',
  'wrapperClassName',
  'containerClassName',
];

interface Literal {
  value: string;
  start: number;
  end: number;
  quote: '"' | "'" | '`';
}

/**
 * Finds string literals, skipping comments so that commented-out markup does not
 * produce findings nobody can act on.
 */
export function findStringLiterals(source: string): Literal[] {
  const literals: Literal[] = [];
  let i = 0;

  while (i < source.length) {
    const char = source[i] as string;
    const next = source[i + 1];

    // Line comment.
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      i = end === -1 ? source.length : end + 1;
      continue;
    }
    // Block comment, including CSS comments.
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    // HTML/JSX comment.
    if (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }

    if (char === '"' || char === "'" || char === '`') {
      const quote = char as '"' | "'" | '`';
      let j = i + 1;
      let value = '';
      while (j < source.length) {
        const c = source[j] as string;
        if (c === '\\') {
          value += source[j + 1] ?? '';
          j += 2;
          continue;
        }
        if (c === quote) break;
        // A template literal hole is a gap in an otherwise ordinary class list.
        if (quote === '`' && c === '$' && source[j + 1] === '{') {
          let depth = 1;
          j += 2;
          while (j < source.length && depth > 0) {
            if (source[j] === '{') depth += 1;
            else if (source[j] === '}') depth -= 1;
            j += 1;
          }
          value += ' ';
          continue;
        }
        value += c;
        j += 1;
      }
      literals.push({ value, start: i, end: j, quote });
      i = j + 1;
      continue;
    }

    i += 1;
  }

  return literals;
}

/** Line number (1-based) of an offset. */
export function lineAt(source: string, offset: number): number {
  let line = 1;
  for (let i = 0; i < offset && i < source.length; i += 1) {
    if (source[i] === '\n') line += 1;
  }
  return line;
}

const ATTRIBUTE_PATTERN = new RegExp(
  `(?:^|[\\s;{(\\[])(${CLASS_ATTRIBUTES.map((a) => a.replace(/[:$]/g, '\\$&')).join('|')})\\s*=\\s*\\{?\\s*$`,
);

const HELPER_PATTERN = new RegExp(`\\b(${CLASS_HELPERS.join('|')})\\s*\\(\\s*(?:[^()]*,\\s*)?$`);

/** Tag name of the element an attribute belongs to, searching backwards. */
function enclosingTag(source: string, offset: number): string | undefined {
  const open = source.lastIndexOf('<', offset);
  if (open === -1) return undefined;
  const close = source.lastIndexOf('>', offset);
  // The attribute has to be inside an unclosed tag.
  if (close > open) return undefined;
  const match = /^<\s*([A-Za-z][\w.-]*)/.exec(source.slice(open, offset));
  return match?.[1];
}

/**
 * Tailwind utilities that are a single bare word. Everything else in the
 * framework carries a hyphen, a colon variant or a bracket, which is what makes
 * "is this a class list or an English sentence" answerable at all: without this
 * list, `Your changes have been saved` scores as five valid utilities.
 */
const BARE_UTILITIES = new Set([
  'flex', 'grid', 'block', 'inline', 'hidden', 'contents', 'table', 'container',
  'relative', 'absolute', 'fixed', 'sticky', 'static', 'isolate', 'visible',
  'invisible', 'italic', 'underline', 'overline', 'truncate', 'uppercase',
  'lowercase', 'capitalize', 'antialiased', 'transform', 'transition', 'resize',
  'group', 'peer', 'border', 'ring', 'shadow', 'rounded', 'outline', 'blur',
  'grayscale', 'invert', 'sepia', 'animate', 'appearance', 'collapse',
  'ordinal', 'wrap', 'nowrap', 'first', 'last', 'only', 'prose',
]);

/** A token that reads as a Tailwind utility rather than an English word. */
export function isUtilityLike(token: string): boolean {
  const bare = token.replace(/^!/, '').replace(/!$/, '');
  const withoutVariants = bare.includes(':') ? (bare.split(':').pop() as string) : bare;
  if (withoutVariants === '') return false;
  // Anything with a hyphen, bracket, slash or variant prefix is structurally a
  // utility; a bare word only counts if Tailwind actually has one by that name.
  if (bare.includes(':') || /[-[\]()/%.#]/.test(withoutVariants)) return true;
  return BARE_UTILITIES.has(withoutVariants.replace(/^-/, ''));
}

export function looksLikeClassList(value: string): boolean {
  const tokens = tokenise(value);
  if (tokens.length === 0) return false;
  // Paths, URLs and markup are the common false positives.
  if (/[<>{}=;]|\.\.\//.test(value)) return false;
  if (value.includes('//')) return false;
  const utilityLike = tokens.filter(isUtilityLike).length;
  return utilityLike / tokens.length >= 0.8;
}

/**
 * Unwraps the value of a framework-bound class attribute.
 *
 * Vue's `:class="'flex gap-2'"` and `:class="{ 'text-red-500': hasError }"` put a
 * JavaScript expression inside the attribute, so the literal we captured is the
 * expression, not the class list.
 */
export function normaliseAttributeValue(value: string): string {
  const trimmed = value.trim();

  // A quoted string inside the attribute: `:class="'flex gap-2'"`.
  const quoted = /^(['"])([\s\S]*)\1$/.exec(trimmed);
  if (quoted) return quoted[2] as string;

  // Object or array syntax: collect the quoted class names out of it.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const names = [...trimmed.matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1] as string);
    return names.join(' ');
  }

  return value;
}

export function tokenise(value: string): string[] {
  return value.split(/\s+/).filter(Boolean);
}

/**
 * Extracts every class list in a file, with the line each was found on.
 */
export function extractClassStrings(
  source: string,
  file: string,
  { includeBareLiterals = true }: { includeBareLiterals?: boolean } = {},
): ClassString[] {
  const results: ClassString[] = [];
  const literals = findStringLiterals(source);

  for (const literal of literals) {
    const before = source.slice(Math.max(0, literal.start - 60), literal.start);
    const line = lineAt(source, literal.start);

    let sourceKind: ClassString['source'] | null = null;
    let tag: string | undefined;

    if (ATTRIBUTE_PATTERN.test(before)) {
      sourceKind = 'attribute';
      tag = enclosingTag(source, literal.start);
    } else if (HELPER_PATTERN.test(before)) {
      sourceKind = 'helper';
    } else if (includeBareLiterals && looksLikeClassList(literal.value)) {
      // A bare literal only counts if it reads overwhelmingly like utilities;
      // this is what catches class lists hoisted into constants.
      sourceKind = 'literal';
    }

    if (sourceKind === null) continue;

    const value = sourceKind === 'attribute' ? normaliseAttributeValue(literal.value) : literal.value;
    const tokens = tokenise(value);
    if (tokens.length === 0) continue;

    results.push({
      value,
      tokens,
      file,
      line,
      source: sourceKind,
      ...(tag !== undefined ? { tag } : {}),
    });
  }

  // Plain markup attributes in templating languages whose values are not JS
  // strings (Blade, Twig, ERB). The lookbehind keeps this from also matching the
  // `class` inside Vue's `:class` / `v-bind:class`, which the literal scan has
  // already handled — without it every bound class was reported twice.
  const htmlAttribute = /(?<![:@\w-])(class|className)\s*=\s*"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = htmlAttribute.exec(source)) !== null) {
    const value = normaliseAttributeValue(match[2] as string);
    const line = lineAt(source, match.index);
    const already = results.some((r) => r.line === line && r.value === value);
    if (already) continue;
    const tokens = tokenise(value);
    if (tokens.length === 0) continue;
    results.push({
      value,
      tokens,
      file,
      line,
      source: 'attribute',
      ...(enclosingTag(source, match.index) !== undefined
        ? { tag: enclosingTag(source, match.index) as string }
        : {}),
    });
  }

  return results.sort((a, b) => a.line - b.line);
}

/** `@apply` directives, which are class lists living inside CSS. */
export function extractApplyDirectives(source: string, file: string): ClassString[] {
  const results: ClassString[] = [];
  const pattern = /@apply\s+([^;{}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const value = (match[1] as string).trim();
    const tokens = tokenise(value);
    if (tokens.length === 0) continue;
    results.push({ value, tokens, file, line: lineAt(source, match.index), source: 'apply' });
  }
  return results;
}

/**
 * `<style>` blocks in a single-file component, with the line each starts on.
 * Shared by the scanner and by the A1 rule.
 */
export function styleBlocksOf(source: string): { content: string; startLine: number }[] {
  const blocks: { content: string; startLine: number }[] = [];
  const pattern = /<style\b[^>]*>([\s\S]*?)<\/style>/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    blocks.push({
      content: match[1] as string,
      startLine: lineAt(source, match.index),
    });
  }
  return blocks;
}
