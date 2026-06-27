export type FollowUpStatus = 'pending' | 'completed' | 'inactive';

export interface FollowUpRecord {
  id: string;
  issueNumber: number;
  repositoryId?: number;
  repositoryOwner?: string;
  repositoryName?: string;
  workflow: string;
  dueAt: Date;
  status: FollowUpStatus;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}
