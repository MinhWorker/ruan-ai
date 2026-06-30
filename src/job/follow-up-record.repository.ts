import {
  FollowUpRecord,
  FollowUpStatus,
} from './interfaces/follow-up-record.interface';

export abstract class FollowUpRecordRepository {
  abstract save(record: FollowUpRecord): Promise<FollowUpRecord>;
  abstract findById(id: string): Promise<FollowUpRecord | null>;
  abstract findByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]>;
  abstract findPendingByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]>;
  abstract findPendingDueBefore(dueAt: Date): Promise<FollowUpRecord[]>;
  abstract updateStatus(
    id: string,
    status: FollowUpStatus,
  ): Promise<FollowUpRecord>;
}
