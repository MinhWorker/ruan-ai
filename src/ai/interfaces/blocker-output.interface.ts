export interface BlockerOutput {
  workflow: 'blocker';
  summary: string;
  likelyCause?: string | null;
  nextProvingMethod: string;
  directHumanQuestions: string[];
  commentBody: string;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  evidence: Array<{
    source: string;
    content: string;
    type: 'observed' | 'inferred';
  }>;
}
