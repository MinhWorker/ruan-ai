export interface AuditRecord {
  id: string;
  jobId?: string;
  workflow?: string;
  deliveryId?: string;
  commentId?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  issueNumber?: number;
  proposedWriteSummary: string;
  policyDecision: 'allowed' | 'rejected' | 'partial';
  writerResultMetadata?: Record<string, any>;
  createdAt: Date;
}
