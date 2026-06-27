/**
 * Evidence item cited by the AI in its triage decision.
 */
export interface TriageEvidence {
  source: string;
  content: string;
}

/**
 * Structured output from the AI triage workflow.
 * Every field is validated before any GitHub writes are attempted.
 */
export interface TriageOutput {
  workflow: 'triage';
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  suggestedLabels: string[];
  missingInformation: string[];
  recommendedNextCommand: '/plan' | 'human_clarification';
  commentBody: string;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  evidence: TriageEvidence[];
}
