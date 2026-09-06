/** Which pile a finding belongs to, in the order the report presents them. */
export type Pile = 'A' | 'B' | 'C';

export interface RuleMeta {
  /** Stable identifier, e.g. `B1`. Used in JSON output and in `--only`. */
  id: string;
  pile: Pile;
  title: string;
  /** What changes between v3 and v4, in one or two sentences. */
  detail: string;
  /** Estimated minutes to deal with one occurrence. A heuristic, and said to be. */
  minutesPerOccurrence: number;
  /** Upper bound on the estimate for a single rule, in hours. */
  maxHours?: number;
}

export interface Occurrence {
  file: string;
  line: number;
  /** The snippet that triggered the rule, trimmed for display. */
  snippet: string;
  /** Extra context, e.g. the specific config key or plugin name. */
  note?: string;
}

export interface Finding {
  rule: RuleMeta;
  occurrences: Occurrence[];
}

export interface ClassString {
  /** The raw contents of the class attribute or helper argument. */
  value: string;
  /** Whitespace-separated tokens. */
  tokens: string[];
  file: string;
  line: number;
  /** How this string was recognised as a class list. */
  source: 'attribute' | 'helper' | 'apply' | 'literal';
  /** The element tag the attribute belonged to, when known. */
  tag?: string;
}

export interface ScannedFile {
  path: string;
  /** Path relative to the project root, for display. */
  relativePath: string;
  extension: string;
  content: string;
}

export interface ProjectContext {
  root: string;
  files: ScannedFile[];
  classStrings: ClassString[];
  packageJson: Record<string, unknown> | null;
  tailwindConfig: Record<string, unknown> | null;
  tailwindConfigPath: string | null;
  browserslist: string[] | null;
}

export interface Report {
  root: string;
  scannedFiles: number;
  findings: Finding[];
  /** Total estimated effort in hours, across all findings. */
  estimatedHours: number;
  riskScore: number;
  riskLabel: 'low' | 'moderate' | 'high' | 'severe';
}
