import { describe, expect, it } from 'vitest';
import {
  buildReport,
  effortForFinding,
  riskLabel,
  riskScore,
  totalEffort,
} from '../src/report/effort.js';
import { formatHours } from '../src/report/markdown.js';
import type { Finding, Occurrence, RuleMeta } from '../src/types.js';

const rule = (over: Partial<RuleMeta> = {}): RuleMeta => ({
  id: 'X1',
  pile: 'B',
  title: 'Test rule',
  detail: '',
  minutesPerOccurrence: 6,
  ...over,
});

const occurrences = (n: number): Occurrence[] =>
  Array.from({ length: n }, (_, i) => ({ file: 'a.tsx', line: i + 1, snippet: 'x' }));

const finding = (n: number, over: Partial<RuleMeta> = {}): Finding => ({
  rule: rule(over),
  occurrences: occurrences(n),
});

describe('effortForFinding', () => {
  it('charges the full rate for the first occurrences', () => {
    expect(effortForFinding(finding(1))).toBeCloseTo(0.1, 5);
    expect(effortForFinding(finding(10))).toBeCloseTo(1, 5);
  });

  it('discounts repeats past the tenth, because the tenth border is not the first', () => {
    const ten = effortForFinding(finding(10));
    const twenty = effortForFinding(finding(20));
    expect(twenty).toBeGreaterThan(ten);
    expect(twenty).toBeLessThan(ten * 2);
  });

  it('is zero for a rule with no per-occurrence cost', () => {
    expect(effortForFinding(finding(5, { minutesPerOccurrence: 0 }))).toBe(0);
  });

  it('is zero when there are no occurrences', () => {
    expect(effortForFinding(finding(0))).toBe(0);
  });

  it('respects a rule’s cap, so one rule cannot swamp the estimate', () => {
    const capped = finding(500, { minutesPerOccurrence: 120, maxHours: 40 });
    expect(effortForFinding(capped)).toBe(40);
  });
});

describe('totalEffort', () => {
  it('adds the findings up and rounds to a tenth of an hour', () => {
    expect(totalEffort([finding(10), finding(10)])).toBe(2);
  });

  it('is zero with no findings', () => {
    expect(totalEffort([])).toBe(0);
  });
});

describe('riskScore', () => {
  it('is zero for a clean project', () => {
    expect(riskScore([])).toBe(0);
  });

  it('weights a blocker far above a rename', () => {
    const blocker = riskScore([finding(1, { pile: 'A' })]);
    const syntax = riskScore([finding(1, { pile: 'C' })]);
    expect(blocker).toBeGreaterThan(syntax * 5);
  });

  it('grows with occurrences but not linearly', () => {
    const one = riskScore([finding(1, { pile: 'B' })]);
    const hundred = riskScore([finding(100, { pile: 'B' })]);
    expect(hundred).toBeGreaterThan(one);
    expect(hundred).toBeLessThan(one * 10);
  });

  it('never exceeds 100', () => {
    const many = Array.from({ length: 20 }, () => finding(500, { pile: 'A' }));
    expect(riskScore(many)).toBe(100);
  });
});

describe('riskLabel', () => {
  it('maps the score onto the four bands', () => {
    expect(riskLabel(0)).toBe('low');
    expect(riskLabel(14)).toBe('low');
    expect(riskLabel(15)).toBe('moderate');
    expect(riskLabel(39)).toBe('moderate');
    expect(riskLabel(40)).toBe('high');
    expect(riskLabel(69)).toBe('high');
    expect(riskLabel(70)).toBe('severe');
    expect(riskLabel(100)).toBe('severe');
  });
});

describe('buildReport', () => {
  it('orders findings by pile, then by rule id', () => {
    const report = buildReport('/x', 10, [
      finding(1, { id: 'C2', pile: 'C' }),
      finding(1, { id: 'B1', pile: 'B' }),
      finding(1, { id: 'A3', pile: 'A' }),
      finding(1, { id: 'B2', pile: 'B' }),
    ]);
    expect(report.findings.map((f) => f.rule.id)).toEqual(['A3', 'B1', 'B2', 'C2']);
  });

  it('carries the file count and computes the score and effort', () => {
    const report = buildReport('/x', 42, [finding(10)]);
    expect(report.scannedFiles).toBe(42);
    expect(report.estimatedHours).toBe(1);
    expect(report.riskScore).toBeGreaterThan(0);
  });
});

describe('formatHours', () => {
  it('reads as minutes below the hour and hours above it', () => {
    expect(formatHours(0.1)).toBe('6 min');
    expect(formatHours(0.5)).toBe('30 min');
    expect(formatHours(1.25)).toBe('1.3 h');
  });

  it('does not print "<0.1 h" where "4 min" is clearer', () => {
    expect(formatHours(4 / 60)).toBe('4 min');
  });

  it('has a floor for genuinely negligible effort', () => {
    expect(formatHours(0)).toBe('<1 min');
  });
});
