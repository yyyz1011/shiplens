import type { ScanOptions, InteractionFlow, Finding, SuppressedFinding, Report } from './index.js';
export interface Requirement {
  id: string;
  description: string;
  page: string;
  flow?: string;
  step?: number;
  viewports?: Array<'desktop' | 'mobile'>;
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
  criterionIds: string[];
  complete: boolean;
  screenshot: string | null;
  observation: string | null;
  screenshotMode?: 'full-page' | 'viewport';
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
  requirements: Array<
    Requirement & {
      viewports: Array<'desktop' | 'mobile'>;
      status: AssessmentStatus | 'pending';
      assessment: Assessment | null;
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
  requiredInputs: RequiredInput[];
}
export class ReviewWorkspace {
  constructor(config: { directory: string; options: ScanOptions });
  collect(input: { requirements: Requirement[]; flows?: InteractionFlow[] }): Promise<ReviewRun>;
  getRun(runId: string): Promise<ReviewRun>;
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
  saveCase(input: { runId: string; name: string }): Promise<SavedCase>;
  recheck(input: { caseId: string; inputs?: Record<string, string> }): Promise<ReviewRun>;
}
