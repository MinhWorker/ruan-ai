export interface PlanEvidence {
  source: string;
  content: string;
}

export interface PlanOutput {
  workflow: 'plan';
  problemStatement: string;
  scope: string[];
  nonScope: string[];
  dependencies: string[];
  taskSequence: string[];
  acceptanceCriteria: string[];
  verificationStrategy: string;
  humanDecisions: string[];
  commentBody: string;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  evidence: PlanEvidence[];
}
