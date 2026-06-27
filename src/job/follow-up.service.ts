import { Injectable } from '@nestjs/common';
import { FollowUpRecord } from './interfaces/follow-up-record.interface';
import { FollowUpRecordRepository } from './follow-up-record.repository';
import * as crypto from 'crypto';

@Injectable()
export class FollowUpService {
  constructor(private readonly repository: FollowUpRecordRepository) {}

  async create(params: {
    issueNumber: number;
    repositoryId?: number;
    repositoryOwner?: string;
    repositoryName?: string;
    workflow: string;
    dueAt: Date;
    reason: string;
  }): Promise<FollowUpRecord> {
    const record: FollowUpRecord = {
      id: crypto.randomUUID(),
      issueNumber: params.issueNumber,
      repositoryId: params.repositoryId,
      repositoryOwner: params.repositoryOwner,
      repositoryName: params.repositoryName,
      workflow: params.workflow,
      dueAt: params.dueAt,
      status: 'pending',
      reason: params.reason,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.repository.save(record);
  }

  async getPendingByIssue(
    issueNumber: number,
    owner: string,
    repo: string,
  ): Promise<FollowUpRecord[]> {
    return this.repository.findPendingByIssue(issueNumber, owner, repo);
  }

  async cancelPendingForIssue(
    issueNumber: number,
    owner: string,
    repo: string,
  ): Promise<void> {
    const pending = await this.repository.findPendingByIssue(
      issueNumber,
      owner,
      repo,
    );
    for (const record of pending) {
      await this.repository.updateStatus(record.id, 'inactive');
    }
  }
}
