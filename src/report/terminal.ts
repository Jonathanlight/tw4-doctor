import pc from 'picocolors';
import type { Report } from '../types.js';
import { effortForFinding } from './effort.js';
import { formatHours } from './markdown.js';

const PILE_HEADINGS: Record<string, string> = {
  A: 'PILE A — blocking: the build will not pass',
  B: 'PILE B — silent visual breakage',
  C: 'PILE C — mechanical syntax (the official tool handles these)',
};

const MAX_LISTED = 20;

export function renderTerminal(report: Report): string {
  const out: string[] = [];
  const colour =
    report.riskLabel === 'severe' || report.riskLabel === 'high'
      ? pc.red
      : report.riskLabel === 'moderate'
        ? pc.yellow
        : pc.green;

  out.push('');
  out.push(pc.bold('tw4-doctor'));
  out.push(pc.dim(`  ${report.root}`));
  out.push(pc.dim(`  ${report.scannedFiles} files scanned`));
  out.push('');
  out.push(
    `  Risk  ${colour(pc.bold(report.riskLabel.toUpperCase()))} ${pc.dim(`(${report.riskScore}/100)`)}`,
  );
  out.push(`  Effort ${pc.bold(`~${report.estimatedHours} h`)} ${pc.dim('(heuristic)')}`);
  out.push('');

  if (report.findings.length === 0) {
    out.push(pc.green('  No findings. Nothing here matches a known v4 breaking change.'));
    out.push('');
    return out.join('\n');
  }

  for (const pile of ['A', 'B', 'C'] as const) {
    const inPile = report.findings.filter((f) => f.rule.pile === pile);
    if (inPile.length === 0) continue;

    const heading = PILE_HEADINGS[pile] as string;
    out.push(pile === 'A' ? pc.red(pc.bold(heading)) : pile === 'B' ? pc.yellow(pc.bold(heading)) : pc.dim(pc.bold(heading)));
    out.push('');

    for (const finding of inPile) {
      out.push(
        `  ${pc.bold(finding.rule.id)}  ${finding.rule.title}  ` +
          pc.dim(`(${finding.occurrences.length}, ~${formatHours(effortForFinding(finding))})`),
      );
      for (const occurrence of finding.occurrences.slice(0, MAX_LISTED)) {
        const note = occurrence.note ? pc.dim(` — ${occurrence.note}`) : '';
        out.push(`      ${pc.cyan(`${occurrence.file}:${occurrence.line}`)}${note}`);
      }
      const remaining = finding.occurrences.length - MAX_LISTED;
      if (remaining > 0) out.push(pc.dim(`      …and ${remaining} more`));
      out.push('');
    }
  }

  return out.join('\n');
}
