import { describe, expect, it } from 'vitest';
import {
  extractApplyDirectives,
  extractClassStrings,
  findStringLiterals,
  lineAt,
  looksLikeClassList,
  tokenise,
} from '../src/scan/extract.js';

const values = (source: string, file = 'a.tsx') =>
  extractClassStrings(source, file).map((c) => c.value);

describe('findStringLiterals', () => {
  it('finds single, double and template literals', () => {
    const found = findStringLiterals(`const a = 'one'; const b = "two"; const c = \`three\`;`);
    expect(found.map((l) => l.value)).toEqual(['one', 'two', 'three']);
  });

  it('handles escaped quotes without ending the literal early', () => {
    expect(findStringLiterals(`const a = 'it\\'s fine';`)[0]?.value).toBe("it's fine");
  });

  it('replaces template holes with a space, keeping the classes either side', () => {
    const found = findStringLiterals('`px-4 ${size} py-2`');
    expect(found[0]?.value).toBe('px-4   py-2');
  });

  it('handles nested braces inside a template hole', () => {
    const found = findStringLiterals('`a ${ { x: 1 } } b`');
    expect(found[0]?.value).toBe('a   b');
  });

  it('skips line, block and HTML comments', () => {
    expect(findStringLiterals(`// const a = 'skipped'\nconst b = 'kept';`).map((l) => l.value)).toEqual(['kept']);
    expect(findStringLiterals(`/* 'skipped' */ const b = 'kept';`).map((l) => l.value)).toEqual(['kept']);
    expect(findStringLiterals(`<!-- <div class="skipped"> --> <div class="kept">`).map((l) => l.value)).toEqual(['kept']);
  });
});

describe('lineAt', () => {
  it('is 1-based and counts newlines', () => {
    const source = 'a\nb\nc';
    expect(lineAt(source, 0)).toBe(1);
    expect(lineAt(source, 2)).toBe(2);
    expect(lineAt(source, 4)).toBe(3);
  });
});

describe('extractClassStrings — attributes', () => {
  it('reads className in JSX', () => {
    expect(values('<div className="flex gap-2" />')).toContain('flex gap-2');
  });

  it('reads plain HTML class', () => {
    expect(values('<div class="flex gap-2"></div>', 'a.html')).toContain('flex gap-2');
  });

  it('reads a JSX expression container', () => {
    expect(values('<div className={"flex gap-2"} />')).toContain('flex gap-2');
  });

  it('reads Vue bound classes', () => {
    expect(values('<div :class="\'flex gap-2\'"></div>', 'a.vue')).toContain('flex gap-2');
  });

  it('records the element the attribute belonged to', () => {
    const found = extractClassStrings('<button className="px-4">Go</button>', 'a.tsx');
    expect(found[0]?.tag).toBe('button');
  });

  it('does not attribute a class to an element whose tag already closed', () => {
    const found = extractClassStrings('<div></div>\nconst x = "flex gap-2 px-4";', 'a.tsx');
    expect(found[0]?.tag).toBeUndefined();
  });
});

describe('extractClassStrings — helpers', () => {
  it('reads clsx, cn, classnames and twMerge arguments', () => {
    for (const helper of ['clsx', 'cn', 'classnames', 'twMerge']) {
      expect(values(`${helper}("flex gap-2")`), helper).toContain('flex gap-2');
    }
  });

  it('reads a later argument, not just the first', () => {
    expect(values('cn(base, "flex gap-2")')).toContain('flex gap-2');
  });

  it('marks helper strings as such', () => {
    const found = extractClassStrings('clsx("flex gap-2")', 'a.tsx');
    expect(found[0]?.source).toBe('helper');
  });
});

describe('extractClassStrings — bare literals', () => {
  it('picks up a class list hoisted into a constant', () => {
    expect(values('const base = "flex items-center gap-2 px-4";')).toContain(
      'flex items-center gap-2 px-4',
    );
  });

  it('ignores prose', () => {
    expect(values('const message = "Your changes have been saved";')).toEqual([]);
  });

  it('ignores import paths and URLs', () => {
    expect(values('import x from "../lib/utils";')).toEqual([]);
    expect(values('const url = "https://example.com/a";')).toEqual([]);
  });

  it('can be turned off entirely', () => {
    const found = extractClassStrings('const base = "flex gap-2 px-4";', 'a.tsx', {
      includeBareLiterals: false,
    });
    expect(found).toEqual([]);
  });
});

describe('looksLikeClassList', () => {
  it('accepts utility lists, including variants and arbitrary values', () => {
    expect(looksLikeClassList('flex gap-2 hover:bg-blue-500')).toBe(true);
    expect(looksLikeClassList('grid-cols-[max-content]')).toBe(true);
  });

  it('rejects sentences and markup', () => {
    expect(looksLikeClassList('Your changes have been saved')).toBe(false);
    expect(looksLikeClassList('<div>hello</div>')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(looksLikeClassList('')).toBe(false);
    expect(looksLikeClassList('   ')).toBe(false);
  });
});

describe('tokenise', () => {
  it('splits on any whitespace and drops empties', () => {
    expect(tokenise('  flex\n  gap-2\t px-4 ')).toEqual(['flex', 'gap-2', 'px-4']);
  });
});

describe('extractApplyDirectives', () => {
  it('reads the utilities out of an @apply', () => {
    const found = extractApplyDirectives('.btn { @apply px-4 py-2 font-bold; }', 'a.css');
    expect(found[0]?.value).toBe('px-4 py-2 font-bold');
    expect(found[0]?.tokens).toEqual(['px-4', 'py-2', 'font-bold']);
  });

  it('reports the right line in a multi-line file', () => {
    const source = '.a {\n  color: red;\n}\n.btn {\n  @apply px-4;\n}';
    expect(extractApplyDirectives(source, 'a.css')[0]?.line).toBe(5);
  });

  it('finds every directive in the file', () => {
    const source = '.a { @apply px-4; }\n.b { @apply py-2; }';
    expect(extractApplyDirectives(source, 'a.css')).toHaveLength(2);
  });
});
