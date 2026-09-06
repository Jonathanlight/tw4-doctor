import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { diagnose } from '../src/index.js';
import { renderMarkdown } from '../src/report/markdown.js';
import type { Report } from '../src/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => join(here, 'fixtures', name);

const ruleIds = (report: Report) => report.findings.map((f) => f.rule.id).sort();
const findingFor = (report: Report, id: string) =>
  report.findings.find((f) => f.rule.id === id);

/**
 * Each fixture is a small but complete project built to exercise one corner of
 * the audit. Running the real scanner over real files on disk is the only way to
 * know the extraction, the config loading and the rules line up.
 */
describe('next-app fixture (pile B and C)', async () => {
  const report = await diagnose(fixture('next-app'));

  it('scans the markup and stylesheet files', () => {
    expect(report.scannedFiles).toBe(4);
  });

  it('finds the borders declared without a colour', () => {
    const finding = findingFor(report, 'B1');
    expect(finding?.occurrences.length).toBeGreaterThanOrEqual(3);
    expect(finding?.occurrences.map((o) => o.file)).toContain('components/Card.tsx');
  });

  it('finds the bare ring, including inside a cn() call', () => {
    expect(findingFor(report, 'B2')?.occurrences).toHaveLength(1);
  });

  it('finds the button with no cursor and the input with no placeholder colour', () => {
    expect(findingFor(report, 'B3')?.occurrences).toHaveLength(1);
    expect(findingFor(report, 'B4')?.occurrences).toHaveLength(1);
  });

  it('finds space-x inside a reversed flex container', () => {
    const finding = findingFor(report, 'B6');
    expect(finding?.occurrences).toHaveLength(1);
    expect(finding?.occurrences[0]?.note).toContain('flex-row-reverse');
  });

  it('finds the syntax changes: important prefix, variable brackets, commas', () => {
    expect(ruleIds(report)).toEqual(expect.arrayContaining(['C1', 'C2', 'C3']));
  });

  it('finds the @tailwind directives and the @layer utilities block', () => {
    expect(findingFor(report, 'C4')?.occurrences).toHaveLength(3);
    expect(findingFor(report, 'C5')?.occurrences).toHaveLength(1);
  });

  it('finds the deeply stacked variant', () => {
    expect(findingFor(report, 'C8')?.occurrences).toHaveLength(1);
  });

  it('reports the browser baseline gap from the package.json browserslist', () => {
    const finding = findingFor(report, 'A4');
    expect(finding?.occurrences.map((o) => o.snippet)).toEqual([
      'chrome >= 90',
      'safari >= 15',
      'firefox >= 115',
    ]);
  });

  it('reports a line number for every occurrence', () => {
    for (const finding of report.findings) {
      for (const occurrence of finding.occurrences) {
        expect(occurrence.line, `${finding.rule.id} ${occurrence.file}`).toBeGreaterThan(0);
      }
    }
  });

  it('never reports the same finding twice at the same place', () => {
    for (const finding of report.findings) {
      const keys = finding.occurrences.map((o) => `${o.file}:${o.line}:${o.snippet}`);
      expect(new Set(keys).size, finding.rule.id).toBe(keys.length);
    }
  });
});

describe('nuxt-app fixture (component style blocks)', async () => {
  const report = await diagnose(fixture('nuxt-app'));

  it('finds @apply in both a scoped and an unscoped component style block', () => {
    const finding = findingFor(report, 'A1');
    expect(finding?.occurrences).toHaveLength(2);
    expect(finding?.occurrences.map((o) => o.file).sort()).toEqual([
      'components/Badge.vue',
      'pages/index.vue',
    ]);
  });

  it('reads classes out of a Vue :class expression without the quotes', () => {
    const border = findingFor(report, 'B1');
    expect(border?.occurrences.some((o) => o.file === 'components/Badge.vue')).toBe(true);
    expect(border?.occurrences.every((o) => !o.snippet.includes("'"))).toBe(true);
  });

  it('reads classes out of a Vue :class object literal', () => {
    expect(findingFor(report, 'B1')?.occurrences.some((o) => o.line === 4)).toBe(true);
  });
});

describe('scss-app fixture (Sass)', async () => {
  const report = await diagnose(fixture('scss-app'));

  it('flags Sass mixed with Tailwind directives', () => {
    const finding = findingFor(report, 'A2');
    expect(finding?.occurrences).toHaveLength(1);
    expect(finding?.occurrences[0]?.file).toBe('styles/main.scss');
  });

  it('makes Sass the dominant cost in the estimate', () => {
    expect(report.estimatedHours).toBeGreaterThan(1);
  });
});

describe('coreplugins-app fixture (removed config keys)', async () => {
  const report = await diagnose(fixture('coreplugins-app'));

  it('finds all three removed config options', () => {
    const finding = findingFor(report, 'A3');
    expect(finding?.occurrences).toHaveLength(3);
    expect(finding?.occurrences.map((o) => o.snippet).sort()).toEqual([
      'corePlugins: …',
      'safelist: …',
      'separator: …',
    ]);
  });

  it('reports the config path relative to the project, not as an absolute path', () => {
    expect(findingFor(report, 'A3')?.occurrences[0]?.file).toBe('tailwind.config.js');
  });

  it('reads the baseline from .browserslistrc, ignoring its comments', () => {
    expect(findingFor(report, 'A4')?.occurrences).toHaveLength(3);
  });

  it('flags the third-party plugin', () => {
    const finding = findingFor(report, 'A5');
    expect(finding?.occurrences[0]?.snippet).toContain('tailwindcss-animate');
    expect(finding?.occurrences[0]?.note).toContain('third-party');
  });

  it('rates a project with three blockers as high risk', () => {
    expect(['high', 'severe']).toContain(report.riskLabel);
  });
});

describe('markdown report', async () => {
  const report = await diagnose(fixture('next-app'));
  const markdown = renderMarkdown(report);

  it('leads with the risk and the effort', () => {
    expect(markdown).toContain('Risk:');
    expect(markdown).toContain('Estimated effort:');
  });

  it('says out loud that the effort figure is a heuristic', () => {
    expect(markdown.toLowerCase()).toContain('heuristic');
  });

  it('has a section per pile that has findings', () => {
    expect(markdown).toContain('Pile B — silent visual breakage');
    expect(markdown).toContain('Pile C — mechanical syntax');
  });

  it('lists every rule it found in the summary table', () => {
    for (const finding of report.findings) {
      expect(markdown, finding.rule.id).toContain(`| ${finding.rule.id} |`);
    }
  });
});
