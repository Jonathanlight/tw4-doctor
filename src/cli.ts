#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { cac } from 'cac';
import pc from 'picocolors';
import { diagnose } from './index.js';
import { renderMarkdown } from './report/markdown.js';
import { renderTerminal } from './report/terminal.js';

const cli = cac('tw4-doctor');

cli
  .command('[root]', 'Audit a Tailwind v3 project for what breaks in v4')
  .option('--json', 'Print the report as JSON instead of text')
  .option('--out <file>', 'Write the markdown report to a file', { default: 'tw4-report.md' })
  .option('--no-markdown', 'Skip writing the markdown report')
  .option('--only <piles>', 'Restrict to some piles, e.g. --only A,B')
  .option('--ignore <glob>', 'Extra glob to ignore (repeatable)')
  .option('--no-bare-literals', 'Ignore class lists found in plain string constants')
  .option(
    '--fail-on <pile>',
    'Exit non-zero when a pile has findings: A, B or C',
  )
  .action(async (root: string | undefined, options: Record<string, unknown>) => {
    const target = resolve(root ?? process.cwd());

    const report = await diagnose(target, {
      ignore: toArray(options['ignore']),
      noBareLiterals: options['bareLiterals'] === false,
    });

    const piles = typeof options['only'] === 'string'
      ? (options['only'] as string).toUpperCase().split(',').map((p) => p.trim())
      : null;
    if (piles) {
      report.findings = report.findings.filter((f) => piles.includes(f.rule.pile));
    }

    if (options['json']) {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
      process.stdout.write(`${renderTerminal(report)}\n`);
    }

    if (options['markdown'] !== false && !options['json']) {
      const out = resolve(target, String(options['out'] ?? 'tw4-report.md'));
      await writeFile(out, renderMarkdown(report), 'utf8');
      process.stdout.write(`${pc.dim(`  Markdown report written to ${out}`)}\n\n`);
    }

    const failOn = typeof options['failOn'] === 'string'
      ? (options['failOn'] as string).toUpperCase()
      : null;
    if (failOn && report.findings.some((f) => f.rule.pile === failOn)) {
      process.exitCode = 1;
    }
  });

cli
  .command('diff [root]', 'Screenshot the project before and after the upgrade (coming in 0.2)')
  .action(() => {
    process.stderr.write(
      `${pc.yellow('tw4-doctor diff is not implemented yet.')}\n` +
        'It is planned for 0.2: build the project as-is, apply @tailwindcss/upgrade to a\n' +
        'copy, build that, screenshot both with Playwright and diff the results. Follow\n' +
        'https://github.com/Jonathanlight/tw4-doctor/issues for progress.\n',
    );
    process.exitCode = 2;
  });

cli.help();
cli.version('0.1.0');

try {
  cli.parse(process.argv, { run: false });
  await cli.runMatchedCommand();
} catch (error) {
  process.stderr.write(`${pc.red('tw4-doctor failed:')} ${(error as Error).message}\n`);
  process.exitCode = 1;
}

function toArray(value: unknown): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value.map(String) : [String(value)];
}
