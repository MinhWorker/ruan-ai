export interface CodingAgentTask {
  id: string;
  title: string;
  objective: string;
  filesToInspect: string[];
  allowedOperations: string[];
  dependencies: string[];
  parallelizationGuidance: string;
  verificationCommands: string[];
  completionEvidence: string;
  ownerType: 'human' | 'coding_agent' | 'blocked';
}

export interface SplitEvidence {
  source: string;
  content: string;
}

export interface SplitOutput {
  workflow: 'split';
  tasks: CodingAgentTask[];
  commentBody: string;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  evidence: SplitEvidence[];
}
