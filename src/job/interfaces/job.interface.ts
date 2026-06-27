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
  repositoryOwner?: string;
  repositoryName?: string;
  senderLogin?: string;
  commentId?: number;
  commentBody?: string;
  installationId?: number;
}
