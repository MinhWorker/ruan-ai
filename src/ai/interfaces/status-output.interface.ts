export interface StatusOutput {
  workflow: 'status';
  state:
    | 'not_started'
    | 'ready'
    | 'in_progress'
    | 'blocked'
    | 'needs_review'
    | 'done'
    | 'paused';
  completedWork: string[];
  openTasks: string[];
  blockers: string[];
  nextAction: string;
  commentBody: string;
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
  evidence: Array<{
    source: string;
    content: string;
    type: 'observed' | 'inferred';
  }>;
}
