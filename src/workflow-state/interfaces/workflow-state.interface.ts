export type WorkflowType =
  | 'triage'
  | 'plan'
  | 'split'
  | 'status'
  | 'blocker'
  | 'pause';

export type WorkflowStateStatus =
  | 'not_started'
  | 'running'
  | 'waiting_human'
  | 'completed'
  | 'failed'
  | 'paused';

export interface WorkflowState {
  installationId?: number;
  repositoryId: number;
  repositoryOwner?: string;
  repositoryName?: string;
  issueNodeId?: string;
  issueNumber: number;
  workflowType: WorkflowType;
  status: WorkflowStateStatus;
  payload: Record<string, unknown>;
  commentId?: number;
  commentNodeId?: string;
  markerLogical?: string;
  markerVersion?: number;
  stateVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowEvent {
  eventId: string;
  repositoryId: number;
  issueNumber: number;
  workflowType: WorkflowType;
  eventType: string;
  stateVersion: number;
  payload: Record<string, unknown>;
  createdAt: Date;
}
