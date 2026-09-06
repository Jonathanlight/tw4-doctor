import type { ClassString, Finding, Occurrence, RuleMeta } from '../types.js';

/**
 * Pile B — the silent visual breakage.
 *
 * These are the changes that produce no error, no warning and a green build.
 * The rendering changes, and the team finds out in QA three weeks later. This is
 * the pile the official upgrade tool will never cover, because every one of
 * these needs a design decision rather than a rewrite.
 */

const BORDER_SIDES = new Set(['x', 'y', 't', 'r', 'b', 'l', 's', 'e']);
/** `border-solid` and friends set a style, not a width and not a colour. */
const BORDER_STYLES = new Set(['solid', 'dashed', 'dotted', 'double', 'hidden', 'none']);

/**
 * An arbitrary value can mean either width or colour depending on what is inside
 * the brackets: `border-[2px]` is a width, `border-[#ff0000]` is a colour. Both
 * match the same utility shape, so the value is the only way to tell them apart.
 */
export function arbitraryValueKind(value: string): 'color' | 'length' | 'unknown' {
  const inner = value.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(inner)) return 'color';
  if (/^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color)\(/i.test(inner)) return 'color';
  if (/^var\(--[\w-]*colou?r/i.test(inner)) return 'color';
  if (/^(?:transparent|currentColor|inherit|black|white)$/i.test(inner)) return 'color';
  if (/^-?[\d.]+(?:px|rem|em|%|vw|vh|ch|ex|pt)$/i.test(inner)) return 'length';
  if (/^-?[\d.]+$/.test(inner)) return 'length';
  return 'unknown';
}

/**
 * Splits a border utility into its side and its remainder, so that `border`,
 * `border-t`, `border-t-2` and `border-t-red-500` can all be classified by the
 * same rule.
 */
function splitBorderUtility(token: string): { rest: string } | null {
  if (token === 'border') return { rest: '' };
  if (!token.startsWith('border-')) return null;
  const parts = token.slice('border-'.length);
  const [first, ...remaining] = parts.split('-');
  if (first !== undefined && BORDER_SIDES.has(first) && remaining.length >= 0) {
    // `border-x` on its own is a side; `border-x-2` is a side plus a value.
    return { rest: remaining.join('-') };
  }
  return { rest: parts };
}

export function isBorderWidth(token: string): boolean {
  const split = splitBorderUtility(token);
  if (split === null) return false;
  const { rest } = split;
  if (rest === '') return true;
  if (/^\d+$/.test(rest)) return true;
  const arbitrary = /^\[([^\]]+)\]$/.exec(rest);
  // An unrecognised arbitrary value is read as a width, which is the reading
  // that produces a finding — better to over-report than to stay silent about a
  // border that may well change colour.
  if (arbitrary) return arbitraryValueKind(arbitrary[1] as string) !== 'color';
  return false;
}

/**
 * Anything that is not a width and not a style is a colour. Written this way on
 * purpose: real projects name their theme colours (`border-input`,
 * `border-border`), and a list of Tailwind's default palette would flag every
 * one of them as an uncoloured border.
 */
export function isBorderColor(token: string): boolean {
  const split = splitBorderUtility(token);
  if (split === null) return false;
  const { rest } = split;
  if (rest === '') return false;
  if (/^\d+$/.test(rest)) return false;
  if (BORDER_STYLES.has(rest)) return false;
  if (rest.startsWith('spacing')) return false;
  const arbitrary = /^\[([^\]]+)\]$/.exec(rest);
  if (arbitrary) return arbitraryValueKind(arbitrary[1] as string) === 'color';
  return true;
}

const RING_WIDTH = /^ring-(?:0|1|2|4|8|\d+|inset)$/;

/** Same reasoning as borders: not a width and not an offset means a colour. */
export function isRingColor(token: string): boolean {
  if (!token.startsWith('ring-')) return false;
  if (token.startsWith('ring-offset-')) return false;
  const rest = token.slice('ring-'.length);
  if (rest === '' || rest === 'inset') return false;
  if (/^\d+$/.test(rest)) return false;
  const arbitrary = /^\[([^\]]+)\]$/.exec(rest);
  if (arbitrary) return arbitraryValueKind(arbitrary[1] as string) === 'color';
  return true;
}

/** Strips any variant prefixes (`hover:`, `md:`, `dark:`) from a token. */
export function baseUtility(token: string): string {
  const withoutImportant = token.replace(/^!/, '').replace(/!$/, '');
  const parts = withoutImportant.split(':');
  return parts[parts.length - 1] as string;
}

export function variantsOf(token: string): string[] {
  const parts = token.replace(/^!/, '').replace(/!$/, '').split(':');
  return parts.slice(0, -1);
}

export const B1: RuleMeta = {
  id: 'B1',
  pile: 'B',
  title: 'Border utility with no colour',
  detail:
    'In v3 a bare `border` is gray-200. In v4 it is `currentColor`. Every border ' +
    'declared without an explicit colour changes colour, usually to the text colour.',
  minutesPerOccurrence: 2,
};

export const B2: RuleMeta = {
  id: 'B2',
  pile: 'B',
  title: 'Ring utility with no width or colour',
  detail:
    'In v3 a bare `ring` is a 3px blue-500 ring. In v4 it is 1px `currentColor`. ' +
    'Focus rings become thin and take the text colour — often invisible against ' +
    'the background. This is an accessibility regression, not just a visual one.',
  minutesPerOccurrence: 4,
};

export const B3: RuleMeta = {
  id: 'B3',
  pile: 'B',
  title: 'Input with no explicit placeholder colour',
  detail:
    'In v3 placeholder text is gray-400. In v4 it is the text colour at 50% ' +
    'opacity. Form placeholder contrast changes everywhere it was left implicit.',
  minutesPerOccurrence: 3,
};

export const B4: RuleMeta = {
  id: 'B4',
  pile: 'B',
  title: 'Button with no explicit cursor-pointer',
  detail:
    'In v3 buttons get `cursor: pointer` from preflight. In v4 they get ' +
    '`cursor: default`, matching the browser. Every button stops showing a hand.',
  minutesPerOccurrence: 1,
};

export const B5: RuleMeta = {
  id: 'B5',
  pile: 'B',
  title: 'hover: as the only interactive state',
  detail:
    'In v4 `hover:` is wrapped in `@media (hover: hover)`. Where a hover style is ' +
    'the only visual state, the element becomes unreachable on touch — no ' +
    'feedback at all on a phone.',
  minutesPerOccurrence: 5,
};

export const B6: RuleMeta = {
  id: 'B6',
  pile: 'B',
  title: 'space-*/divide-* combined with a reversed or reordered container',
  detail:
    'The generated selector changes from `> :not([hidden]) ~ :not([hidden])` to ' +
    '`> :not(:last-child)`. In a `flex-row-reverse`, `flex-col-reverse` or ' +
    'explicitly ordered container the spacing lands on the wrong side.',
  minutesPerOccurrence: 8,
};

function occurrence(c: ClassString, note?: string): Occurrence {
  return {
    file: c.file,
    line: c.line,
    snippet: c.value.length > 100 ? `${c.value.slice(0, 97)}…` : c.value,
    ...(note !== undefined ? { note } : {}),
  };
}

/** A border width utility with no matching colour anywhere in the same class list. */
export function findBorderWithoutColor(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const bases = c.tokens.map(baseUtility);
    const hasWidth = bases.some(isBorderWidth);
    if (!hasWidth) continue;
    // `border-gray-200`, `border-[#fff]` and friends all count as a colour.
    if (bases.some(isBorderColor)) continue;
    found.push(occurrence(c, bases.filter(isBorderWidth).join(' ')));
  }
  return found;
}

export function findRingWithoutWidthOrColor(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const bases = c.tokens.map(baseUtility);
    // Only the bare `ring` changes meaning; `ring-2` already states its width.
    const bare = bases.filter((t) => t === 'ring');
    if (bare.length === 0) continue;
    const hasExplicitWidth = bases.some((t) => RING_WIDTH.test(t));
    const hasColor = bases.some(isRingColor);
    if (hasExplicitWidth && hasColor) continue;
    found.push(
      occurrence(c, hasColor ? 'width changes 3px -> 1px' : 'becomes 1px currentColor'),
    );
  }
  return found;
}

export function findButtonsWithoutCursor(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    if (c.tag?.toLowerCase() !== 'button') continue;
    const bases = c.tokens.map(baseUtility);
    if (bases.some((t) => t.startsWith('cursor-'))) continue;
    found.push(occurrence(c, 'add cursor-pointer'));
  }
  return found;
}

export function findHoverOnlyStates(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const variantSets = c.tokens.map(variantsOf);
    const hasHover = variantSets.some((v) => v.includes('hover'));
    if (!hasHover) continue;
    // A hover style paired with focus or active still has a non-hover path.
    const hasOther = variantSets.some(
      (v) => v.includes('focus') || v.includes('focus-visible') || v.includes('active'),
    );
    if (hasOther) continue;
    found.push(occurrence(c, 'no focus: or active: alongside hover:'));
  }
  return found;
}

const REVERSE_OR_ORDER = /^(?:flex-(?:row|col)-reverse|order-\S+)$/;
const SPACE_OR_DIVIDE = /^(?:space-[xy]-\S+|divide-[xy](?:-\S+)?)$/;

export function findSpacingInReversedContainers(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const bases = c.tokens.map(baseUtility);
    const spacing = bases.filter((t) => SPACE_OR_DIVIDE.test(t));
    if (spacing.length === 0) continue;
    const reversed = bases.filter((t) => REVERSE_OR_ORDER.test(t));
    if (reversed.length === 0) continue;
    found.push(occurrence(c, `${spacing.join(' ')} with ${reversed.join(' ')}`));
  }
  return found;
}

/** Any other use of the spacing utilities: worth reviewing, but lower risk. */
export function findSpacingUtilities(classStrings: ClassString[]): Occurrence[] {
  return classStrings
    .filter((c) => c.tokens.map(baseUtility).some((t) => SPACE_OR_DIVIDE.test(t)))
    .map((c) => occurrence(c));
}

const INPUT_TAGS = new Set(['input', 'textarea']);

export function findPlaceholdersWithoutColor(classStrings: ClassString[]): Occurrence[] {
  const found: Occurrence[] = [];
  for (const c of classStrings) {
    const tag = c.tag?.toLowerCase();
    if (tag === undefined || !INPUT_TAGS.has(tag)) continue;
    if (c.tokens.some((t) => t.includes('placeholder'))) continue;
    found.push(occurrence(c, 'placeholder colour becomes text colour at 50%'));
  }
  return found;
}

export function runPileB(classStrings: ClassString[]): Finding[] {
  const findings: Finding[] = [
    { rule: B1, occurrences: findBorderWithoutColor(classStrings) },
    { rule: B2, occurrences: findRingWithoutWidthOrColor(classStrings) },
    { rule: B3, occurrences: findPlaceholdersWithoutColor(classStrings) },
    { rule: B4, occurrences: findButtonsWithoutCursor(classStrings) },
    { rule: B5, occurrences: findHoverOnlyStates(classStrings) },
    { rule: B6, occurrences: findSpacingInReversedContainers(classStrings) },
  ];
  return findings.filter((f) => f.occurrences.length > 0);
}
