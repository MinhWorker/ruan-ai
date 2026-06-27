export type TelemetrySeverity = 'info' | 'warn' | 'error';
export type TelemetryWorkflowType =
  | 'triage'
  | 'plan'
  | 'split'
  | 'status'
  | 'blocker'
  | 'stop'
  | 'unknown';
export type TelemetryEventType =
  | 'job_lifecycle'
  | 'model_call'
  | 'validation_failure'
  | 'rate_limit'
  | 'policy_decision'
  | 'github_write'
  | 'operational_error';

export interface TelemetryEvent {
  id: string;
  type: TelemetryEventType;
  severity: TelemetrySeverity;
  timestamp: Date;
  jobId?: string;
  workflow?: TelemetryWorkflowType;
  repositoryOwner?: string;
  repositoryName?: string;
  issueNumber?: number;
  message: string;
  metadata?: Record<string, any>;
}
