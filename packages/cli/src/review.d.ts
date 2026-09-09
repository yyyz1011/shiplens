import type { ScanOptions, InteractionFlow, Finding, SuppressedFinding, Report } from './index.js';
export interface Requirement {
  id: string;
  description: string;
  page: string;
  flow?: string;
  step?: number;
  selector?: string;
  viewports?: Array<'desktop' | 'mobile'>;
  checks?: Array<{ operator: 'equals' | 'contains' | 'excludes'; value: string }>;
  evaluation?: 'manual' | 'checks';
}
export interface CheckVerification {
  source: 'deterministic-checks';
  status: AssessmentStatus;
  evidenceIds: string[];
  results: Array<{
    viewport: 'desktop' | 'mobile';
    evidenceId?: string;
    checkIndex?: number;
    status: AssessmentStatus;
    reason: string;
  }>;
}
export type AssessmentStatus = 'pass' | 'fail' | 'needs-evidence';
export interface Assessment {
  assessmentId: string;
  runId: string;
  criterionId: string;
  status: AssessmentStatus;
  evidenceIds: string[];
  note: string;
  recordedAt: string;
  source: 'caller-assessment';
}
export interface Evidence {
  evidenceId: string;
  page: string;
  viewport: 'desktop' | 'mobile';
  flow?: string;
  step?: number;
  selector?: string;
  criterionIds: string[];
  complete: boolean;
  screenshot: string | null;
  observation: string | null;
  screenshotMode?: 'full-page' | 'viewport' | 'element';
  failureKind?: 'timeout' | 'action-or-policy';
  notes: string[];
  status: 'complete' | 'incomplete' | 'passed' | 'failed' | 'skipped';
}
export interface RequiredInput {
  key: string;
  flow: string;
  selector: string;
}
export interface ReviewRun {
  runId: string;
  createdAt: string;
  previousRunId?: string;
  caseId?: string;
  planSource?: { name: string; sha256: string };
  requirements: Array<
    Requirement & {
      viewports: Array<'desktop' | 'mobile'>;
      status: AssessmentStatus | 'pending';
      assessment: Assessment | null;
      verification?: CheckVerification;
    }
  >;
  evidence: Evidence[];
  otherEvidenceCount: number;
  history: Assessment[];
  requiredInputs: RequiredInput[];
  machine: { summary: Report['summary']; truncated: boolean; comparison?: Report['comparison'] };
  note: string;
}
export interface Observation {
  schemaVersion: 1;
  capturedAt: string;
  url: string;
  scope: string;
  text: string;
  textTruncated: boolean;
  elementsTruncated: boolean;
  elements: Array<{
    selector: string;
    tag: string;
    role: string | null;
    text: string;
    disabled: boolean;
    bounds: { x: number; y: number; width: number; height: number };
  }>;
}
export interface EvidenceResult {
  evidence: Evidence;
  observation: Observation | null;
  findings: Finding[];
  suppressed: SuppressedFinding[];
  image?: { type: 'image'; mimeType: 'image/png'; data: string };
  warning: string;
}
export interface SavedCase {
  caseId: string;
  name: string;
  sourceRunId: string;
  tags?: string[];
  revision?: number;
  requiredInputs: RequiredInput[];
}
export class ReviewWorkspace {
  constructor(config: { directory: string; options: ScanOptions });
  validatePlan(input: { data: PortableCase }): PlanInfo;
  verify(
    input: {
      data: PortableCase;
      inputs?: Record<string, string>;
      failOn?: 'error' | 'warning';
      format?: 'html' | 'json' | 'markdown';
      lang?: 'en' | 'zh';
    },
    runtime?: ReviewRuntime,
  ): Promise<PlanVerification>;
  collect(
    input: { requirements: Requirement[]; flows?: InteractionFlow[] },
    runtime?: ReviewRuntime,
  ): Promise<ReviewRun>;
  getRun(runId: string): Promise<ReviewRun>;
  reviewPacket(input: {
    runId: string;
    offset?: number;
    limit?: number;
    includeImages?: boolean;
    includePassed?: boolean;
    maxBytes?: number;
  }): Promise<ReviewPacket>;
  readEvidence(input: {
    runId: string;
    evidenceId: string;
    includeImage?: boolean;
  }): Promise<EvidenceResult>;
  assess(input: {
    runId: string;
    criterionId: string;
    status: AssessmentStatus;
    evidenceIds: string[];
    note: string;
  }): Promise<ReviewRun>;
  saveCase(input: { runId: string; name: string; tags?: string[] }): Promise<SavedCase>;
  recheck(
    input: { caseId: string; inputs?: Record<string, string>; previousRunId?: string },
    runtime?: ReviewRuntime,
  ): Promise<ReviewRun>;
  getStatus(): {
    running: boolean;
    startedAt?: string;
    progress: Parameters<NonNullable<ScanOptions['onProgress']>>[0] | null;
  };
  cancel(): { requested: boolean };
  listCases(input?: ListOptions & { tag?: string }): Promise<ListResult<CaseInfo>>;
  listRuns(input?: ListOptions): Promise<
    ListResult<{
      runId: string;
      createdAt: string;
      caseId?: string;
      requirementCount: number;
      requirementIds: string[];
    }>
  >;
  getCase(
    caseId: string,
  ): Promise<CaseInfo & { requirements: Requirement[]; flows: PortableFlow[] }>;
  updateCase(input: { caseId: string; name?: string; tags?: string[] }): Promise<CaseInfo>;
  exportCase(input: { caseId: string }): Promise<PortableCase>;
  importCase(input: { data: PortableCase }): Promise<CaseInfo>;
  compareRuns(input: { runId: string; previousRunId: string }): Promise<RunComparison>;
  gate(input: { runId: string; failOn?: 'error' | 'warning' }): Promise<AcceptanceGate>;
  exportReport(input: {
    runId: string;
    previousRunId?: string;
    format?: 'html' | 'json' | 'markdown';
    includeImages?: boolean;
    lang?: 'en' | 'zh';
    failOn?: 'error' | 'warning';
  }): Promise<{
    runId: string;
    format: string;
    file: string;
    bytes: number;
    gate: AcceptanceGate;
    warnings: string[];
  }>;
}

export interface ReviewPacket {
  runId: string;
  requirements: Array<Omit<ReviewRun['requirements'][number], 'assessment'>>;
  total: number;
  offset: number;
  nextOffset: number | null;
  items: Array<EvidenceResult & { omitted: string[]; readSeparately: boolean }>;
  bytes: number;
  note: string;
}

export interface PlanInfo {
  name: string;
  sha256: string;
  requirementCount: number;
  flowCount: number;
  requiredInputs: RequiredInput[];
  automaticRequirements: string[];
  manualRequirements: string[];
  note: string;
}
export interface PlanVerification {
  runId: string;
  plan: PlanInfo;
  gate: AcceptanceGate;
  report: Awaited<ReturnType<ReviewWorkspace['exportReport']>>;
  unresolved: Array<{
    criterionId: string;
    status: AssessmentStatus | 'pending';
    verification?: CheckVerification;
  }>;
  next: { method: 'reviewPacket'; input: { runId: string } } | null;
}

export interface ReviewRuntime {
  signal?: AbortSignal;
  timeoutMs?: number;
  onProgress?: ScanOptions['onProgress'];
}
export interface ListOptions {
  query?: string;
  offset?: number;
  limit?: number;
}
export interface ListResult<T> {
  items: T[];
  total: number;
  nextOffset: number | null;
}
export interface CaseInfo extends Omit<SavedCase, 'sourceRunId'> {
  sourceRunId?: string;
  createdAt: string;
  tags: string[];
  revision: number;
  requirementCount: number;
}
export interface PortableFlow {
  name: string;
  page: string;
  steps: Array<
    | {
        action: 'click' | 'press' | 'select' | 'waitFor' | 'expectText';
        selector: string;
        timeout?: number;
        value?: string;
        key?: string;
        state?: 'visible' | 'hidden';
      }
    | { action: 'fill'; selector: string; timeout?: number; valueFromInput: string }
  >;
}
export interface PortableCase {
  schemaVersion: 1;
  kind: 'shiplens-case';
  name: string;
  tags: string[];
  requirements: Requirement[];
  flows: PortableFlow[];
}
export interface AcceptanceGate {
  runId: string;
  passed: boolean;
  counts: Record<AssessmentStatus | 'pending', number>;
  failOn: 'error' | 'warning';
  reasons: string[];
  note: string;
}
export interface RunComparison {
  runId: string;
  previousRunId: string;
  removed: string[];
  note: string;
  criteria: Array<{
    criterionId: string;
    beforeStatus: AssessmentStatus | 'pending' | null;
    afterStatus: AssessmentStatus | 'pending';
    comparable: boolean;
    transition:
      | 'added'
      | 'not-comparable'
      | 'awaiting-review'
      | 'resolved'
      | 'regressed'
      | 'still-failing'
      | 'still-passing'
      | 'reviewed';
    pairs: Array<{
      viewport: 'desktop' | 'mobile';
      beforeEvidenceId: string | null;
      afterEvidenceId: string | null;
      comparable: boolean;
      imageChanged: boolean | null;
      textChanged: boolean | null;
      beforeText: string | null;
      afterText: string | null;
    }>;
  }>;
}
