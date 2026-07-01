import { Injectable } from '@nestjs/common';
import {
  FollowUpRecord,
  FollowUpStatus,
} from './interfaces/follow-up-record.interface';
import { FollowUpRecordRepository } from './follow-up-record.repository';

@Injectable()
export class InMemoryFollowUpRecordRepository implements FollowUpRecordRepository {
  private readonly records = new Map<string, FollowUpRecord>();

  async save(record: FollowUpRecord): Promise<FollowUpRecord> {
    await Promise.resolve();
    this.records.set(record.id, record);
    return { ...record };
  }

  async findById(id: string): Promise<FollowUpRecord | null> {
    await Promise.resolve();
    const record = this.records.get(id);
    return record ? { ...record } : null;
  }

  async findByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]> {
    await Promise.resolve();
    return Array.from(this.records.values())
      .filter(
        (r) =>
          r.issueNumber === issueNumber &&
          r.repositoryOwner === repositoryOwner &&
          r.repositoryName === repositoryName,
      )
      .map((r) => ({ ...r }));
  }

  async findPendingByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]> {
    await Promise.resolve();
    return Array.from(this.records.values())
      .filter(
        (r) =>
          r.issueNumber === issueNumber &&
          r.repositoryOwner === repositoryOwner &&
          r.repositoryName === repositoryName &&
          r.status === 'pending',
      )
      .map((r) => ({ ...r }));
  }

  async findPendingDueBefore(dueAt: Date): Promise<FollowUpRecord[]> {
    await Promise.resolve();
    return Array.from(this.records.values())
      .filter((r) => r.status === 'pending' && r.dueAt <= dueAt)
      .map((r) => ({ ...r }));
  }

  async updateStatus(
    id: string,
    status: FollowUpStatus,
  ): Promise<FollowUpRecord> {
    await Promise.resolve();
    const record = this.records.get(id);
    if (!record) {
      throw new Error(`FollowUpRecord not found: ${id}`);
    }
    record.status = status;
    record.updatedAt = new Date();
    this.records.set(id, record);
    return { ...record };
  }
}
