import { describe, expect, it } from 'vitest';
import { extractClassStrings } from '../src/scan/extract.js';
import {
  findBracketVariableShorthand,
  findCommasInArbitraryValues,
  findCssDirectives,
  findDeeplyStackedVariants,
  findImportantPrefix,
  findRemovedUtilities,
  findRenamedUtilities,
} from '../src/rules/pileC.js';

const from = (classList: string) => extractClassStrings(`<div className="${classList}" />`, 'a.tsx');

describe('C1 — important prefix', () => {
  it('flags a prefixed important and shows the suffix form', () => {
    const found = findImportantPrefix(from('!flex'));
    expect(found).toHaveLength(1);
    expect(found[0]?.note).toContain('!flex -> flex!');
  });

  it('flags it after variants too', () => {
    expect(findImportantPrefix(from('hover:!underline'))).toHaveLength(1);
  });

  it('does not flag a class already using the suffix', () => {
    expect(findImportantPrefix(from('flex!'))).toHaveLength(0);
  });
});

describe('C2 — variable shorthand brackets', () => {
  it('flags a bracketed variable and shows the parenthesised form', () => {
    const found = findBracketVariableShorthand(from('bg-[--brand]'));
    expect(found[0]?.note).toContain('bg-(--brand)');
  });

  it('does not flag an ordinary arbitrary value', () => {
    expect(findBracketVariableShorthand(from('bg-[#fff]'))).toHaveLength(0);
  });
});

describe('C3 — commas in arbitrary values', () => {
  it('flags a comma separating values', () => {
    expect(findCommasInArbitraryValues(from('grid-cols-[max-content,auto]'))).toHaveLength(1);
  });

  it('does not flag commas inside a function call, which stay legal', () => {
    expect(findCommasInArbitraryValues(from('bg-[rgb(0,0,0)]'))).toHaveLength(0);
  });

  it('does not flag an arbitrary value with no comma', () => {
    expect(findCommasInArbitraryValues(from('w-[calc(100%-2rem)]'))).toHaveLength(0);
  });
});

describe('C6 — renamed utilities', () => {
  it('maps the shifted shadow and rounded scales', () => {
    expect(findRenamedUtilities(from('shadow-sm'))[0]?.note).toContain('shadow-sm -> shadow-xs');
    expect(findRenamedUtilities(from('shadow'))[0]?.note).toContain('shadow -> shadow-sm');
    expect(findRenamedUtilities(from('rounded'))[0]?.note).toContain('rounded -> rounded-sm');
  });

  it('maps outline-none and the bare ring', () => {
    expect(findRenamedUtilities(from('outline-none'))[0]?.note).toContain('outline-hidden');
    expect(findRenamedUtilities(from('ring'))[0]?.note).toContain('ring -> ring-3');
  });

  it('looks past variants', () => {
    expect(findRenamedUtilities(from('hover:shadow'))).toHaveLength(1);
  });

  it('does not flag a name that did not move', () => {
    expect(findRenamedUtilities(from('shadow-lg'))).toHaveLength(0);
  });
});

describe('C7 — removed utilities', () => {
  it('flags the opacity utilities', () => {
    expect(findRemovedUtilities(from('bg-opacity-50'))[0]?.note).toContain('modifier');
    expect(findRemovedUtilities(from('text-opacity-75'))).toHaveLength(1);
  });

  it('flags the flex shorthand renames', () => {
    expect(findRemovedUtilities(from('flex-shrink-0'))[0]?.note).toContain('shrink-*');
    expect(findRemovedUtilities(from('flex-grow'))[0]?.note).toContain('grow-*');
  });

  it('flags overflow-ellipsis and the decoration pair', () => {
    expect(findRemovedUtilities(from('overflow-ellipsis'))).toHaveLength(1);
    expect(findRemovedUtilities(from('decoration-clone'))).toHaveLength(1);
  });

  it('does not flag the replacements themselves', () => {
    expect(findRemovedUtilities(from('shrink-0 grow text-ellipsis'))).toHaveLength(0);
  });
});

describe('C8 — deeply stacked variants', () => {
  it('flags three or more stacked variants', () => {
    expect(findDeeplyStackedVariants(from('md:dark:hover:focus:underline'))).toHaveLength(1);
  });

  it('does not flag one or two', () => {
    expect(findDeeplyStackedVariants(from('hover:underline'))).toHaveLength(0);
    expect(findDeeplyStackedVariants(from('md:hover:underline'))).toHaveLength(0);
  });

  it('does not miscount colons inside an arbitrary variant', () => {
    expect(findDeeplyStackedVariants(from('[&:nth-child(2)]:underline'))).toHaveLength(0);
  });
});

describe('C4 and C5 — CSS directives', () => {
  const files = [
    {
      relativePath: 'app.css',
      content: '@tailwind base;\n@tailwind utilities;\n\n@layer utilities {\n  .x { color: red }\n}',
    },
  ];

  it('finds each @tailwind directive with its line', () => {
    const { c4 } = findCssDirectives(files);
    expect(c4).toHaveLength(2);
    expect(c4[0]?.line).toBe(1);
    expect(c4[1]?.line).toBe(2);
  });

  it('finds the @layer utilities block', () => {
    const { c5 } = findCssDirectives(files);
    expect(c5).toHaveLength(1);
    expect(c5[0]?.line).toBe(4);
  });

  it('finds nothing in a stylesheet that has already been migrated', () => {
    const migrated = [{ relativePath: 'app.css', content: '@import "tailwindcss";\n@utility x { color: red }' }];
    const result = findCssDirectives(migrated);
    expect(result.c4).toHaveLength(0);
    expect(result.c5).toHaveLength(0);
  });
});
