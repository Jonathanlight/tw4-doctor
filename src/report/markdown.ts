import type { Finding, Report } from '../types.js';
import { effortForFinding } from './effort.js';

const PILE_TITLES: Record<string, string> = {
  A: 'Pile A — blocking: the build will not pass',
  B: 'Pile B — silent visual breakage',
  C: 'Pile C — mechanical syntax (the official tool handles these)',
};

const MAX_LISTED = 20;

export function renderMarkdown(report: Report): string {
  const lines: string[] = [];

  lines.push('# Tailwind v4 upgrade report');
  lines.push('');
  lines.push(`Project: \`${report.root}\`  `);
  lines.push(`Files scanned: ${report.scannedFiles}  `);
  lines.push(`Risk: **${report.riskLabel}** (${report.riskScore}/100)  `);
  lines.push(`Estimated effort: **~${report.estimatedHours} h**`);
  lines.push('');
  lines.push(
    '> Effort figures are a heuristic, not a promise: a constant per occurrence, ' +
      'with repeats discounted. They are meant to size a quote, not to schedule one.',
  );
  lines.push('');

  if (report.findings.length === 0) {
    lines.push('No findings. Nothing in this project matches a known v4 breaking change.');
    lines.push('');
    return lines.join('\n');
  }

  lines.push('## Summary');
  lines.push('');
  lines.push('| Rule | Pile | What | Occurrences | ~Effort |');
  lines.push('|---|---|---|---:|---:|');
  for (const finding of report.findings) {
    lines.push(
      `| ${finding.rule.id} | ${finding.rule.pile} | ${finding.rule.title} | ` +
        `${finding.occurrences.length} | ${formatHours(effortForFinding(finding))} |`,
    );
  }
  lines.push('');

  for (const pile of ['A', 'B', 'C'] as const) {
    const inPile = report.findings.filter((f) => f.rule.pile === pile);
    if (inPile.length === 0) continue;

    lines.push(`## ${PILE_TITLES[pile]}`);
    lines.push('');
    for (const finding of inPile) {
      lines.push(...renderFinding(finding));
    }
  }

  return lines.join('\n');
}

function renderFinding(finding: Finding): string[] {
  const lines: string[] = [];
  lines.push(`### ${finding.rule.id} — ${finding.rule.title}`);
  lines.push('');
  lines.push(finding.rule.detail);
  lines.push('');
  lines.push(
    `**${finding.occurrences.length} occurrence${finding.occurrences.length === 1 ? '' : 's'}**, ` +
      `~${formatHours(effortForFinding(finding))}`,
  );
  lines.push('');

  for (const occurrence of finding.occurrences.slice(0, MAX_LISTED)) {
    const note = occurrence.note ? ` — ${occurrence.note}` : '';
    lines.push(`- \`${occurrence.file}:${occurrence.line}\`${note}`);
    lines.push(`  \`\`\`\n  ${occurrence.snippet}\n  \`\`\``);
  }

  const remaining = finding.occurrences.length - MAX_LISTED;
  if (remaining > 0) lines.push(`- …and ${remaining} more`);
  lines.push('');

  return lines;
}

export function formatHours(hours: number): string {
  const minutes = hours * 60;
  if (minutes < 1) return '<1 min';
  if (hours < 1) return `${Math.round(minutes)} min`;
  return `${Math.round(hours * 10) / 10} h`;
}
