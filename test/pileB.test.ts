import { describe, expect, it } from 'vitest';
import { extractClassStrings } from '../src/scan/extract.js';
import {
  baseUtility,
  isBorderColor,
  isBorderWidth,
  isRingColor,
  findBorderWithoutColor,
  findButtonsWithoutCursor,
  findHoverOnlyStates,
  findPlaceholdersWithoutColor,
  findRingWithoutWidthOrColor,
  findSpacingInReversedContainers,
  variantsOf,
} from '../src/rules/pileB.js';

const classes = (source: string, file = 'a.tsx') => extractClassStrings(source, file);
const from = (classList: string, tag = 'div') => classes(`<${tag} className="${classList}" />`);

describe('baseUtility and variantsOf', () => {
  it('strips variants and important markers', () => {
    expect(baseUtility('hover:md:bg-red-500')).toBe('bg-red-500');
    expect(baseUtility('!flex')).toBe('flex');
    expect(baseUtility('flex')).toBe('flex');
  });

  it('lists the variants in order', () => {
    expect(variantsOf('md:hover:underline')).toEqual(['md', 'hover']);
    expect(variantsOf('underline')).toEqual([]);
  });
});

describe('B1 — border without colour', () => {
  it('flags a bare border', () => {
    expect(findBorderWithoutColor(from('border p-4'))).toHaveLength(1);
  });

  it('flags directional and sized borders', () => {
    expect(findBorderWithoutColor(from('border-t'))).toHaveLength(1);
    expect(findBorderWithoutColor(from('border-2'))).toHaveLength(1);
    expect(findBorderWithoutColor(from('border-x-4'))).toHaveLength(1);
  });

  it('does not flag a border that states its colour', () => {
    expect(findBorderWithoutColor(from('border border-gray-200'))).toHaveLength(0);
    expect(findBorderWithoutColor(from('border border-black'))).toHaveLength(0);
    expect(findBorderWithoutColor(from('border border-[#ff0000]'))).toHaveLength(0);
  });

  it('does not flag a class list with no border at all', () => {
    expect(findBorderWithoutColor(from('flex gap-2 rounded'))).toHaveLength(0);
  });

  it('looks past variants when finding the colour', () => {
    expect(findBorderWithoutColor(from('border hover:border-blue-500'))).toHaveLength(0);
  });
});

describe('B2 — ring without width or colour', () => {
  it('flags a bare ring', () => {
    expect(findRingWithoutWidthOrColor(from('ring'))).toHaveLength(1);
  });

  it('flags a bare ring even with a colour, because the width still changes', () => {
    const found = findRingWithoutWidthOrColor(from('ring ring-blue-500'));
    expect(found).toHaveLength(1);
    expect(found[0]?.note).toContain('3px -> 1px');
  });

  it('does not flag a ring that states both width and colour', () => {
    expect(findRingWithoutWidthOrColor(from('ring-2 ring-blue-500'))).toHaveLength(0);
  });

  it('does not treat ring-offset as the ring colour', () => {
    expect(findRingWithoutWidthOrColor(from('ring ring-offset-2'))).toHaveLength(1);
  });
});

describe('B3 — placeholder colour', () => {
  it('flags an input with no placeholder utility', () => {
    expect(findPlaceholdersWithoutColor(from('border px-2', 'input'))).toHaveLength(1);
  });

  it('flags a textarea too', () => {
    expect(findPlaceholdersWithoutColor(from('border', 'textarea'))).toHaveLength(1);
  });

  it('does not flag an input that sets its placeholder colour', () => {
    expect(
      findPlaceholdersWithoutColor(from('border placeholder:text-gray-400', 'input')),
    ).toHaveLength(0);
  });

  it('does not flag a div', () => {
    expect(findPlaceholdersWithoutColor(from('border', 'div'))).toHaveLength(0);
  });
});

describe('B4 — button cursor', () => {
  it('flags a button with no cursor utility', () => {
    expect(findButtonsWithoutCursor(from('px-4 py-2', 'button'))).toHaveLength(1);
  });

  it('does not flag a button that sets one', () => {
    expect(findButtonsWithoutCursor(from('px-4 cursor-pointer', 'button'))).toHaveLength(0);
    expect(findButtonsWithoutCursor(from('px-4 cursor-not-allowed', 'button'))).toHaveLength(0);
  });

  it('does not flag a non-button', () => {
    expect(findButtonsWithoutCursor(from('px-4', 'a'))).toHaveLength(0);
  });
});

describe('B5 — hover as the only state', () => {
  it('flags a hover style with no focus or active alongside it', () => {
    expect(findHoverOnlyStates(from('hover:bg-blue-600'))).toHaveLength(1);
  });

  it('does not flag hover paired with focus or active', () => {
    expect(findHoverOnlyStates(from('hover:bg-blue-600 focus:bg-blue-700'))).toHaveLength(0);
    expect(findHoverOnlyStates(from('hover:bg-blue-600 active:bg-blue-800'))).toHaveLength(0);
    expect(findHoverOnlyStates(from('hover:underline focus-visible:underline'))).toHaveLength(0);
  });

  it('does not flag a class list with no hover at all', () => {
    expect(findHoverOnlyStates(from('flex gap-2'))).toHaveLength(0);
  });
});

describe('B6 — spacing in a reversed container', () => {
  it('flags space-x with flex-row-reverse', () => {
    const found = findSpacingInReversedContainers(from('flex flex-row-reverse space-x-4'));
    expect(found).toHaveLength(1);
    expect(found[0]?.note).toContain('flex-row-reverse');
  });

  it('flags divide with an explicit order', () => {
    expect(findSpacingInReversedContainers(from('divide-y order-2'))).toHaveLength(1);
  });

  it('does not flag spacing in an ordinary container', () => {
    expect(findSpacingInReversedContainers(from('flex space-x-4'))).toHaveLength(0);
  });

  it('does not flag a reversed container with no spacing utility', () => {
    expect(findSpacingInReversedContainers(from('flex flex-col-reverse gap-4'))).toHaveLength(0);
  });
});

/**
 * These came out of running the tool on a real shadcn/ui codebase, where every
 * border uses a semantic theme colour. A colour list built from Tailwind's
 * default palette flagged all of them, which would have made the whole rule
 * noise on the projects most likely to run it.
 */
describe('border classification against real-world class lists', () => {
  it('treats a semantic theme colour as a colour', () => {
    expect(isBorderColor('border-input')).toBe(true);
    expect(isBorderColor('border-border')).toBe(true);
    expect(isBorderColor('border-destructive')).toBe(true);
    expect(findBorderWithoutColor(from('rounded-md border border-input'))).toHaveLength(0);
  });

  it('treats a palette colour as a colour', () => {
    expect(isBorderColor('border-gray-200')).toBe(true);
    expect(isBorderColor('border-t-red-500')).toBe(true);
    expect(isBorderColor('border-white')).toBe(true);
  });

  it('treats widths as widths, on any side', () => {
    expect(isBorderWidth('border')).toBe(true);
    expect(isBorderWidth('border-b')).toBe(true);
    expect(isBorderWidth('border-l-4')).toBe(true);
    expect(isBorderColor('border-b')).toBe(false);
    expect(isBorderColor('border-2')).toBe(false);
  });

  it('treats a border style as neither, so border-solid alone is not a finding', () => {
    expect(isBorderWidth('border-solid')).toBe(false);
    expect(isBorderColor('border-solid')).toBe(false);
    expect(findBorderWithoutColor(from('border-dashed'))).toHaveLength(0);
  });

  it('reads an arbitrary value by its content', () => {
    expect(isBorderColor('border-[#ff0000]')).toBe(true);
    expect(isBorderColor('border-[rgb(0,0,0)]')).toBe(true);
    expect(isBorderWidth('border-[2px]')).toBe(true);
    expect(isBorderColor('border-[2px]')).toBe(false);
  });

  it('classifies ring colours the same way', () => {
    expect(isRingColor('ring-ring')).toBe(true);
    expect(isRingColor('ring-blue-500')).toBe(true);
    expect(isRingColor('ring-2')).toBe(false);
    expect(isRingColor('ring-inset')).toBe(false);
    // An offset colour is not the ring's own colour.
    expect(isRingColor('ring-offset-background')).toBe(false);
  });

  it('does not flag a ring that states width and a semantic colour', () => {
    expect(findRingWithoutWidthOrColor(from('ring-2 ring-ring'))).toHaveLength(0);
  });
});
