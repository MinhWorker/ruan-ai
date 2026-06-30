import { Inject, Injectable } from '@nestjs/common';
import { Job, JobStatus } from '../interfaces/job.interface';
import { JobRepository } from '../job.repository';
import { PG_POOL } from './pg-pool';
import type { DbJobRow, PgPoolLike } from './pg-pool';

@Injectable()
export class PostgresJobRepository implements JobRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPoolLike) {}

  async save(job: Job): Promise<Job> {
    const queryText = `
      INSERT INTO jobs (
        job_id, delivery_id, status, attempts, workflow_type, created_at, updated_at,
        issue_number, repository_id, repository_owner, repository_name, sender_login,
        comment_id, comment_body, installation_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (job_id) DO UPDATE SET
        status = EXCLUDED.status,
        attempts = EXCLUDED.attempts,
        updated_at = EXCLUDED.updated_at,
        issue_number = EXCLUDED.issue_number,
        repository_id = EXCLUDED.repository_id,
        repository_owner = EXCLUDED.repository_owner,
        repository_name = EXCLUDED.repository_name,
        sender_login = EXCLUDED.sender_login,
        comment_id = EXCLUDED.comment_id,
        comment_body = EXCLUDED.comment_body,
        installation_id = EXCLUDED.installation_id
      RETURNING *
    `;

    const updatedAt = new Date();
    const params = [
      job.jobId,
      job.deliveryId,
      job.status,
      job.attempts,
      job.workflowType,
      job.createdAt,
      updatedAt,
      job.issueNumber ?? null,
      job.repositoryId ?? null,
      job.repositoryOwner ?? null,
      job.repositoryName ?? null,
      job.senderLogin ?? null,
      job.commentId ?? null,
      job.commentBody ?? null,
      job.installationId ?? null,
    ];

    const res = await this.pool.query<DbJobRow>(queryText, params);
    return mapRowToJob(res.rows[0]);
  }

  async findById(jobId: string): Promise<Job | null> {
    const queryText = `SELECT * FROM jobs WHERE job_id = $1`;
    const res = await this.pool.query<DbJobRow>(queryText, [jobId]);
    if (res.rowCount === 0) {
      return null;
    }
    return mapRowToJob(res.rows[0]);
  }

  async findByDeliveryId(deliveryId: string): Promise<Job | null> {
    const queryText = `SELECT * FROM jobs WHERE delivery_id = $1`;
    const res = await this.pool.query<DbJobRow>(queryText, [deliveryId]);
    if (res.rowCount === 0) {
      return null;
    }
    return mapRowToJob(res.rows[0]);
  }

  async findAll(): Promise<Job[]> {
    const queryText = `SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1000`;
    const res = await this.pool.query<DbJobRow>(queryText);
    return res.rows.map(mapRowToJob);
  }
}

function mapRowToJob(row: DbJobRow): Job {
  return {
    jobId: row.job_id,
    deliveryId: row.delivery_id,
    status: row.status as JobStatus,
    attempts: Number(row.attempts),
    workflowType: row.workflow_type,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    issueNumber: row.issue_number ? Number(row.issue_number) : undefined,
    repositoryId: row.repository_id ? Number(row.repository_id) : undefined,
    repositoryOwner: row.repository_owner ?? undefined,
    repositoryName: row.repository_name ?? undefined,
    senderLogin: row.sender_login ?? undefined,
    commentId: row.comment_id ? Number(row.comment_id) : undefined,
    commentBody: row.comment_body ?? undefined,
    installationId: row.installation_id
      ? Number(row.installation_id)
      : undefined,
  };
}
