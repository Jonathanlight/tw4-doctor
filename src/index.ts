/**
 * tw4-doctor — audit a Tailwind v3 codebase before upgrading to v4.
 *
 * Run this BEFORE `npx @tailwindcss/upgrade`. They are complementary: the
 * official tool performs the migration, this one tells you what it will cost and
 * what it cannot fix for you.
 */
import { scanProject, type ScanOptions } from './scan/project.js';
import { runPileA } from './rules/pileA.js';
import { runPileB } from './rules/pileB.js';
import { runPileC } from './rules/pileC.js';
import { buildReport } from './report/effort.js';
import { STYLE_EXTENSIONS } from './scan/project.js';
import type { Report } from './types.js';

export async function diagnose(root: string, options: ScanOptions = {}): Promise<Report> {
  const context = await scanProject(root, options);

  const styleFiles = context.files.filter((f) => STYLE_EXTENSIONS.includes(f.extension));

  const findings = [
    ...runPileA(context),
    ...runPileB(context.classStrings),
    ...runPileC(context.classStrings, styleFiles),
  ];

  return buildReport(context.root, context.files.length, findings);
}

export { scanProject, type ScanOptions } from './scan/project.js';
export { runPileA } from './rules/pileA.js';
export { runPileB } from './rules/pileB.js';
export { runPileC } from './rules/pileC.js';
export { buildReport, effortForFinding, riskLabel, riskScore, totalEffort } from './report/effort.js';
export { renderMarkdown, formatHours } from './report/markdown.js';
export { renderTerminal } from './report/terminal.js';
export {
  extractApplyDirectives,
  extractClassStrings,
  isUtilityLike,
  looksLikeClassList,
  normaliseAttributeValue,
  tokenise,
} from './scan/extract.js';

export type {
  ClassString,
  Finding,
  Occurrence,
  Pile,
  ProjectContext,
  Report,
  RuleMeta,
  ScannedFile,
} from './types.js';
