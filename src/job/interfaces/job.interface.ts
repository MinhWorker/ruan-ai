export type JobStatus =
  | 'queued'
  | 'running'
  | 'waiting_human'
  | 'delayed'
  | 'completed'
  | 'failed'
  | 'paused';

export interface Job {
  jobId: string;
  deliveryId: string;
  status: JobStatus;
  attempts: number;
  workflowType: string;
  createdAt: Date;
  updatedAt: Date;
  issueNumber?: number;
  repositoryId?: number;
  installationId?: number;
}
