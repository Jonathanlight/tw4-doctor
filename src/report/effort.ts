import type { Finding, Report } from '../types.js';

/**
 * Effort and risk scoring.
 *
 * These are heuristics and the report says so out loud. The point is not to be
 * right to the hour; it is to turn "we should migrate at some point" into a
 * number an agency can put in a quote and defend.
 */

/** Occurrences of the same rule get cheaper: the tenth border is not the first. */
export function effortForFinding(finding: Finding): number {
  const count = finding.occurrences.length;
  const minutes = finding.rule.minutesPerOccurrence;
  if (count === 0 || minutes === 0) return 0;

  // First ten occurrences at full price, the rest at a third — that is roughly
  // how find-and-review across a codebase actually goes.
  const full = Math.min(count, 10);
  const remainder = Math.max(0, count - 10);
  const totalMinutes = full * minutes + remainder * minutes * 0.33;

  const hours = totalMinutes / 60;
  return finding.rule.maxHours ? Math.min(hours, finding.rule.maxHours) : hours;
}

export function totalEffort(findings: Finding[]): number {
  const hours = findings.reduce((sum, finding) => sum + effortForFinding(finding), 0);
  return Math.round(hours * 10) / 10;
}

/** Weight per pile: a blocker costs more attention than a rename. */
const PILE_WEIGHT = { A: 10, B: 4, C: 0.5 } as const;

/**
 * A 0-100 risk score. Occurrences are counted logarithmically, because the
 * difference between 1 and 20 borders matters and the difference between 400 and
 * 800 does not.
 */
export function riskScore(findings: Finding[]): number {
  let score = 0;
  for (const finding of findings) {
    const weight = PILE_WEIGHT[finding.rule.pile];
    score += weight * (1 + Math.log10(finding.occurrences.length));
  }
  return Math.min(100, Math.round(score));
}

export function riskLabel(score: number): Report['riskLabel'] {
  if (score >= 70) return 'severe';
  if (score >= 40) return 'high';
  if (score >= 15) return 'moderate';
  return 'low';
}

export function buildReport(
  root: string,
  scannedFiles: number,
  findings: Finding[],
): Report {
  const ordered = [...findings].sort((a, b) => {
    const pile = a.rule.pile.localeCompare(b.rule.pile);
    if (pile !== 0) return pile;
    return a.rule.id.localeCompare(b.rule.id);
  });
  const score = riskScore(ordered);
  return {
    root,
    scannedFiles,
    findings: ordered,
    estimatedHours: totalEffort(ordered),
    riskScore: score,
    riskLabel: riskLabel(score),
  };
}
