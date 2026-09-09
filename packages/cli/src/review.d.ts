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
  planLock?: { sha256: string; definitionSha256: string; policySha256: string };
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
  constructor(config: {
    directory: string;
    options: ScanOptions;
    acceptanceLock?: { lock: AcceptanceLock; sha256: string };
  });
  createPlanLock(input: { data: PortableCase; failOn?: 'error' | 'warning' }): AcceptanceLock;
  checkPlanLock(input: { data: PortableCase; failOn?: 'error' | 'warning' }): PlanLockCheck;
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
  verifyDelivery(
    input: { contract: DeliveryContract; inputs?: Record<string, string> },
    runtime?: ReviewRuntime,
  ): Promise<DeliveryResult>;
  getDelivery(input: { deliveryId: string }): Promise<DeliveryResult>;
  readDeliveryEvidence(input: {
    deliveryId: string;
    viewport: 'desktop' | 'mobile';
    phase: 'success' | 'failure';
  }): Promise<{
    deliveryId: string;
    trial: DeliveryTrial;
    observation: Observation;
    image: NonNullable<EvidenceResult['image']>;
    warning: string;
  }>;
  getRun(runId: string): Promise<ReviewRun>;
  auditChecks(input: CheckAuditInput): Promise<CheckAudit>;
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
export interface AcceptanceLock {
  schemaVersion: 1;
  kind: 'shiplens-plan-lock';
  plan: PortableCase;
  policy: {
    entry: string;
    pages: string[];
    viewport: 'desktop' | 'mobile' | 'both';
    exclude: string[];
    ignoreRules: string[];
    ignore: NonNullable<ScanOptions['ignore']>;
    mask: string[];
    allowRequests: NonNullable<ScanOptions['allowRequests']>;
    maxPages: number;
    crawl: boolean;
    scroll: boolean;
    scrollSteps: number;
    waitFor: string;
    timeout: number;
    settle: number;
    failOn: 'error' | 'warning';
  };
  sha256: string;
}
export interface PlanLockCheck {
  kind: 'shiplens-plan-lock-check';
  passed: boolean;
  status: 'matched' | 'changed' | 'invalid-plan';
  lockSha256: string;
  definitionSha256?: string;
  policySha256?: string;
  changes: Array<{
    kind:
      | 'requirement-removed'
      | 'requirement-added'
      | 'requirement-changed'
      | 'flows-changed'
      | 'policy-changed';
    field: string;
    criterionId?: string;
    before: string | null;
    after: string | null;
  }>;
  totalChanges: number;
  changesTruncated: boolean;
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
  planLock?: { sha256: string; matched: boolean };
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

export interface CheckAuditInput {
  runId: string;
  criterionIds?: string[];
  offset?: number;
  limit?: number;
  maxBytes?: number;
  counterexamples?: Array<{ criterionId: string; label: string; text: string }>;
}
export interface CheckAudit {
  schemaVersion: 1;
  kind: 'shiplens-check-audit';
  runId: string;
  planSource?: { name: string; sha256: string };
  scope: 'offline-text-counterexamples';
  total: number;
  offset: number;
  nextOffset: number | null;
  items: Array<{
    criterionId: string;
    description: string;
    checks: NonNullable<Requirement['checks']>;
    status: 'no-checks' | 'baseline-failing' | 'needs-evidence' | 'audited';
    baselineStatus?: AssessmentStatus;
    samples: Array<{
      evidenceId: string;
      viewport: 'desktop' | 'mobile';
      sourceSha256: string;
      observedText: string;
      numericCandidates: number;
      numericTested: number;
      probes: Array<{
        kind: 'empty' | 'loading' | 'error-suffix' | 'number-change' | 'custom';
        label?: string;
        text: string;
        result: 'caught' | 'survived' | 'unchanged';
        failedCheckIndexes: number[];
      }>;
    }>;
  }>;
  pageSummary: {
    audited: number;
    skipped: number;
    caught: number;
    survived: number;
    unchanged: number;
  };
  bytes: number;
  note: string;
}

export interface DeliveryContract {
  schemaVersion: 1;
  kind: 'shiplens-delivery';
  name: string;
  page: string;
  referenceInput: string;
  steps: PortableFlow['steps'];
  request: { method: 'POST' | 'PUT' | 'PATCH'; path: string };
  readback: {
    path: string;
    queryKey?: string;
    items: string;
    reference: string;
    checks: Array<{ pointer: string; equals: string | number | boolean | null }>;
  };
  success: { selector: string; checks: NonNullable<Requirement['checks']> };
  failure: { selector: string; checks: NonNullable<Requirement['checks']> };
}
export interface DeliveryReadback {
  status: 'complete' | 'unavailable';
  httpStatus?: number;
  count?: number;
  checks?: Array<{
    pointer: string;
    matched: boolean;
    actual?: string | number | boolean | null;
    actualOmitted?: boolean;
  }>;
  reason?: string;
}
export interface DeliveryTrial {
  viewport: 'desktop' | 'mobile';
  phase: 'success' | 'failure';
  reference?: string;
  passed: boolean;
  status: 'pass' | 'fail' | 'needs-evidence' | 'skipped';
  reasons: string[];
  network?: {
    matched: number;
    statuses: number[];
    failed: number;
    blocked: number;
    injected: number;
  };
  before?: DeliveryReadback | null;
  after?: DeliveryReadback | null;
  ui?: { passed: boolean; observedText: string; checks: boolean[] } | null;
  successDuringFailure?: boolean;
  evidence: { image: string; observation: string; selector: string } | null;
}
export interface DeliveryResult {
  schemaVersion: 1;
  kind: 'shiplens-delivery-result';
  version: string;
  deliveryId: string;
  name: string;
  contractSha256: string;
  createdAt: string;
  passed: boolean;
  trials: DeliveryTrial[];
  report: string;
  note: string;
}
