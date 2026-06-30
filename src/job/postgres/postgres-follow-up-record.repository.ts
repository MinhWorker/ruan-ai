import { Inject, Injectable } from '@nestjs/common';
import {
  FollowUpRecord,
  FollowUpStatus,
} from '../interfaces/follow-up-record.interface';
import { FollowUpRecordRepository } from '../follow-up-record.repository';
import { PG_POOL } from './pg-pool';
import type { DbFollowUpRow, PgPoolLike } from './pg-pool';

@Injectable()
export class PostgresFollowUpRecordRepository implements FollowUpRecordRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPoolLike) {}

  async save(record: FollowUpRecord): Promise<FollowUpRecord> {
    const queryText = `
      INSERT INTO follow_up_records (
        id, issue_number, repository_id, repository_owner, repository_name,
        workflow, due_at, status, reason, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        issue_number = EXCLUDED.issue_number,
        repository_id = EXCLUDED.repository_id,
        repository_owner = EXCLUDED.repository_owner,
        repository_name = EXCLUDED.repository_name,
        workflow = EXCLUDED.workflow,
        status = EXCLUDED.status,
        due_at = EXCLUDED.due_at,
        updated_at = EXCLUDED.updated_at,
        reason = EXCLUDED.reason
      RETURNING *
    `;

    const params = [
      record.id,
      record.issueNumber,
      record.repositoryId ?? null,
      record.repositoryOwner ?? null,
      record.repositoryName ?? null,
      record.workflow,
      record.dueAt,
      record.status,
      record.reason,
      record.createdAt,
      record.updatedAt,
    ];

    const res = await this.pool.query<DbFollowUpRow>(queryText, params);
    return mapRowToFollowUpRecord(res.rows[0]);
  }

  async findById(id: string): Promise<FollowUpRecord | null> {
    const queryText = `SELECT * FROM follow_up_records WHERE id = $1`;
    const res = await this.pool.query<DbFollowUpRow>(queryText, [id]);
    if (res.rowCount === 0) {
      return null;
    }
    return mapRowToFollowUpRecord(res.rows[0]);
  }

  async findByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]> {
    const queryText = `
      SELECT * FROM follow_up_records
      WHERE issue_number = $1 AND repository_owner = $2 AND repository_name = $3
    `;
    const res = await this.pool.query<DbFollowUpRow>(queryText, [
      issueNumber,
      repositoryOwner,
      repositoryName,
    ]);
    return res.rows.map(mapRowToFollowUpRecord);
  }

  async findPendingByIssue(
    issueNumber: number,
    repositoryOwner: string,
    repositoryName: string,
  ): Promise<FollowUpRecord[]> {
    const queryText = `
      SELECT * FROM follow_up_records
      WHERE issue_number = $1 AND repository_owner = $2 AND repository_name = $3 AND status = 'pending'
    `;
    const res = await this.pool.query<DbFollowUpRow>(queryText, [
      issueNumber,
      repositoryOwner,
      repositoryName,
    ]);
    return res.rows.map(mapRowToFollowUpRecord);
  }

  async findPendingDueBefore(dueAt: Date): Promise<FollowUpRecord[]> {
    const queryText = `
      SELECT * FROM follow_up_records
      WHERE status = 'pending' AND due_at <= $1
      ORDER BY due_at ASC
    `;
    const res = await this.pool.query<DbFollowUpRow>(queryText, [dueAt]);
    return res.rows.map(mapRowToFollowUpRecord);
  }

  async updateStatus(
    id: string,
    status: FollowUpStatus,
  ): Promise<FollowUpRecord> {
    const queryText = `
      UPDATE follow_up_records
      SET status = $2, updated_at = $3
      WHERE id = $1
      RETURNING *
    `;
    const updatedAt = new Date();
    const res = await this.pool.query<DbFollowUpRow>(queryText, [
      id,
      status,
      updatedAt,
    ]);
    if (res.rowCount === 0) {
      throw new Error(`FollowUpRecord not found: ${id}`);
    }
    return mapRowToFollowUpRecord(res.rows[0]);
  }
}

function mapRowToFollowUpRecord(row: DbFollowUpRow): FollowUpRecord {
  return {
    id: row.id,
    issueNumber: Number(row.issue_number),
    repositoryId: row.repository_id ? Number(row.repository_id) : undefined,
    repositoryOwner: row.repository_owner ?? undefined,
    repositoryName: row.repository_name ?? undefined,
    workflow: row.workflow,
    dueAt: new Date(row.due_at),
    status: row.status as FollowUpStatus,
    reason: row.reason,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
