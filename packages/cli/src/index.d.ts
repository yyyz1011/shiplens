export type InteractionStep = { selector: string; timeout?: number } & (
  | { action: 'click' }
  | { action: 'fill' | 'select' | 'expectText'; value: string }
  | { action: 'press'; key: string }
  | { action: 'waitFor'; state?: 'visible' | 'hidden' }
);
export interface InteractionFlow {
  name: string;
  page: string;
  steps: InteractionStep[];
}
export interface IgnoreEntry {
  rule: string;
  reason: string;
  page?: string;
  viewport?: 'desktop' | 'mobile';
  selector?: string;
  messageIncludes?: string;
  fingerprint?: string;
  expires?: string;
}
export interface StepResult {
  observation?: string;
  index: number;
  action: InteractionStep['action'];
  selector: string;
  status: 'passed' | 'failed' | 'skipped';
  screenshot: string | null;
  detail?: string;
}
export interface ScanOptions {
  url: string;
  pages?: string[];
  crawl?: boolean;
  captureDom?: boolean;
  maxPages?: number;
  viewport?: 'desktop' | 'mobile' | 'both';
  timeout?: number;
  settle?: number;
  waitFor?: string;
  scroll?: boolean;
  scrollSteps?: number;
  storageState?: string;
  allowRequests?: Array<{ method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }>;
  mask?: string[];
  ignoreRules?: string[];
  flows?: InteractionFlow[];
  ignore?: IgnoreEntry[];
  output?: string;
  exclude?: string[];
  baseline?: string;
  lang?: 'en' | 'zh';
  onProgress?: (event: { url: string; viewport: string; page: number; flow?: string }) => void;
}
export interface Finding {
  code: string;
  severity: 'error' | 'warning';
  title: string;
  detail: string;
  subject: string;
  url: string;
  viewport: string;
  screenshot: string | null;
  elementScreenshot?: string;
  selector?: string;
  statusCode?: number;
  fingerprint: string;
  flow?: string;
  step?: number;
  elements?: Array<{ selector: string; right: number; width: number }>;
}
export interface SuppressedFinding extends Finding {
  suppression: { index: number; reason: string; expires?: string };
}
export interface PageCheck {
  observation?: string;
  flow?: string;
  steps?: StepResult[];
  viewport: string;
  status: 'complete' | 'incomplete';
  screenshot: string | null;
  screenshotMode?: 'full-page' | 'viewport';
  scrollTruncated: boolean;
  notes: string[];
  blockedRequests: number;
  httpStatus?: number | null;
  finalUrl?: string;
}
export interface Report {
  schemaVersion: 2;
  version: string;
  target: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  runDirectory: string;
  lang: 'en' | 'zh';
  options: Record<string, unknown>;
  summary: {
    pages: number;
    checks: number;
    errors: number;
    warnings: number;
    incomplete: number;
    groups: number;
    scrollLimited: number;
    suppressed: number;
  };
  pages: Array<{ url: string; title?: string; discoveredFrom: string; checks: PageCheck[] }>;
  findings: Finding[];
  suppressed: SuppressedFinding[];
  ignoreWarnings: string[];
  skipped: Array<{ url: string; viewport: string; reason: string }>;
  truncated: boolean;
  remainingPages: number;
  comparison?: {
    new: string[];
    unchanged: string[];
    absent: string[];
    resolved: string[];
    comparable: boolean;
    note: string;
  };
}
export function scan(options: ScanOptions): Promise<Report>;
export function validateOptions(options: ScanOptions): ScanOptions;
export function compareBaseline(
  findings: Finding[],
  baseline: { schemaVersion: 1 | 2; findings: Array<{ fingerprint: string }> },
): { new: string[]; unchanged: string[]; absent: string[] };
