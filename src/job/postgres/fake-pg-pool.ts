import {
  DbFollowUpRow,
  DbJobRow,
  DbWorkflowEventRow,
  DbWorkflowStateRow,
  PgPoolLike,
} from './pg-pool';

export class FakePgPool implements PgPoolLike {
  public readonly jobs = new Map<string, DbJobRow>();
  public readonly followUps = new Map<string, DbFollowUpRow>();
  public readonly workflowStates = new Map<string, DbWorkflowStateRow>();
  public readonly workflowEvents = new Map<string, DbWorkflowEventRow>();

  query<T = unknown>(
    text: string,
    params: unknown[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    const sql = text.trim().replace(/\s+/g, ' ');

    // ----------------------------------------------------
    // JOBS TABLE QUERIES
    // ----------------------------------------------------

    // 1. SELECT * FROM jobs WHERE job_id = $1
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM jobs') &&
      sql.includes('job_id = $1')
    ) {
      const jobId = params[0] as string;
      const job = this.jobs.get(jobId);
      return Promise.resolve({
        rows: (job ? [job] : []) as unknown as T[],
        rowCount: job ? 1 : 0,
      });
    }

    // 2. SELECT * FROM jobs WHERE delivery_id = $1
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM jobs') &&
      sql.includes('delivery_id = $1')
    ) {
      const deliveryId = params[0] as string;
      const job = Array.from(this.jobs.values()).find(
        (j) => j.delivery_id === deliveryId,
      );
      return Promise.resolve({
        rows: (job ? [job] : []) as unknown as T[],
        rowCount: job ? 1 : 0,
      });
    }

    // 3. SELECT * FROM jobs
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM jobs') &&
      !sql.includes('WHERE')
    ) {
      const allJobs = Array.from(this.jobs.values())
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
        .slice(0, 1000);
      return Promise.resolve({
        rows: allJobs as unknown as T[],
        rowCount: allJobs.length,
      });
    }

    // 4. INSERT/UPSERT INTO jobs
    if (sql.startsWith('INSERT INTO jobs')) {
      const row: DbJobRow = {
        job_id: params[0] as string,
        delivery_id: params[1] as string,
        status: params[2] as string,
        attempts: params[3] as number,
        workflow_type: params[4] as string,
        created_at: params[5] as Date,
        updated_at: params[6] as Date,
        issue_number: params[7] as number | null,
        repository_id: params[8] as number | null,
        repository_owner: params[9] as string | null,
        repository_name: params[10] as string | null,
        sender_login: params[11] as string | null,
        comment_id: params[12] as number | null,
        comment_body: params[13] as string | null,
        installation_id: params[14] as number | null,
      };
      this.jobs.set(row.job_id, row);
      return Promise.resolve({
        rows: [row] as unknown as T[],
        rowCount: 1,
      });
    }

    // ----------------------------------------------------
    // FOLLOW_UP_RECORDS TABLE QUERIES
    // ----------------------------------------------------

    // 1. SELECT * FROM follow_up_records WHERE id = $1
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM follow_up_records') &&
      sql.includes('id = $1')
    ) {
      const id = params[0] as string;
      const rec = this.followUps.get(id);
      return Promise.resolve({
        rows: (rec ? [rec] : []) as unknown as T[],
        rowCount: rec ? 1 : 0,
      });
    }

    // 2. findByIssue or findPendingByIssue
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM follow_up_records') &&
      sql.includes('issue_number = $1')
    ) {
      const issueNumber = params[0] as number;
      const repositoryOwner = params[1] as string;
      const repositoryName = params[2] as string;
      const isPendingOnly = sql.includes("status = 'pending'");

      const filtered = Array.from(this.followUps.values()).filter((r) => {
        const matchesBase =
          Number(r.issue_number) === Number(issueNumber) &&
          r.repository_owner === repositoryOwner &&
          r.repository_name === repositoryName;
        if (!matchesBase) return false;
        if (isPendingOnly) {
          return r.status === 'pending';
        }
        return true;
      });

      return Promise.resolve({
        rows: filtered as unknown as T[],
        rowCount: filtered.length,
      });
    }

    // 3. findPendingDueBefore
    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM follow_up_records') &&
      sql.includes("status = 'pending'") &&
      sql.includes('due_at <= $1')
    ) {
      const dueAt = params[0] as Date;
      const filtered = Array.from(this.followUps.values())
        .filter((r) => r.status === 'pending' && r.due_at <= dueAt)
        .sort((a, b) => a.due_at.getTime() - b.due_at.getTime());

      return Promise.resolve({
        rows: filtered as unknown as T[],
        rowCount: filtered.length,
      });
    }

    // 4. UPDATE follow_up_records SET status = $2, updated_at = $3 WHERE id = $1 RETURNING *
    if (sql.startsWith('UPDATE follow_up_records SET status = $2')) {
      const id = params[0] as string;
      const status = params[1] as string;
      const updatedAt = params[2] as Date;
      const rec = this.followUps.get(id);
      if (!rec) {
        throw new Error(`FollowUpRecord not found in fake db: ${id}`);
      }
      rec.status = status;
      rec.updated_at = updatedAt;
      this.followUps.set(id, rec);
      return Promise.resolve({
        rows: [rec] as unknown as T[],
        rowCount: 1,
      });
    }

    // 5. INSERT/UPSERT INTO follow_up_records
    if (sql.startsWith('INSERT INTO follow_up_records')) {
      const row: DbFollowUpRow = {
        id: params[0] as string,
        issue_number: params[1] as number,
        repository_id: params[2] as number | null,
        repository_owner: params[3] as string | null,
        repository_name: params[4] as string | null,
        workflow: params[5] as string,
        due_at: params[6] as Date,
        status: params[7] as string,
        reason: params[8] as string,
        created_at: params[9] as Date,
        updated_at: params[10] as Date,
      };
      this.followUps.set(row.id, row);
      return Promise.resolve({
        rows: [row] as unknown as T[],
        rowCount: 1,
      });
    }

    // ----------------------------------------------------
    // WORKFLOW_STATES TABLE QUERIES
    // ----------------------------------------------------

    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM workflow_states') &&
      sql.includes('repository_id = $1') &&
      sql.includes('issue_number = $2') &&
      sql.includes('workflow_type = $3')
    ) {
      const key = makeWorkflowKey(
        params[0] as number,
        params[1] as number,
        params[2] as string,
      );
      const row = this.workflowStates.get(key);
      return Promise.resolve({
        rows: (row ? [row] : []) as unknown as T[],
        rowCount: row ? 1 : 0,
      });
    }

    if (sql.startsWith('INSERT INTO workflow_states')) {
      const key = makeWorkflowKey(
        params[1] as number,
        params[5] as number,
        params[6] as string,
      );
      const existing = this.workflowStates.get(key);
      const row: DbWorkflowStateRow = {
        installation_id: params[0] as number | null,
        repository_id: params[1] as number,
        repository_owner: params[2] as string | null,
        repository_name: params[3] as string | null,
        issue_node_id: params[4] as string | null,
        issue_number: params[5] as number,
        workflow_type: params[6] as string,
        status: params[7] as string,
        payload: params[8] as Record<string, unknown>,
        comment_id: params[9] as number | null,
        comment_node_id: params[10] as string | null,
        marker_logical: params[11] as string | null,
        marker_version: params[12] as number | null,
        state_version: existing ? existing.state_version + 1 : 1,
        created_at: existing?.created_at ?? (params[13] as Date),
        updated_at: params[14] as Date,
      };
      this.workflowStates.set(key, row);
      return Promise.resolve({
        rows: [row] as unknown as T[],
        rowCount: 1,
      });
    }

    // ----------------------------------------------------
    // WORKFLOW_EVENTS TABLE QUERIES
    // ----------------------------------------------------

    if (
      sql.startsWith('SELECT') &&
      sql.includes('FROM workflow_events') &&
      sql.includes('repository_id = $1') &&
      sql.includes('issue_number = $2') &&
      sql.includes('workflow_type = $3')
    ) {
      const rows = Array.from(this.workflowEvents.values())
        .filter(
          (row) =>
            row.repository_id === params[0] &&
            row.issue_number === params[1] &&
            row.workflow_type === params[2],
        )
        .sort((a, b) => a.created_at.getTime() - b.created_at.getTime());
      return Promise.resolve({
        rows: rows as unknown as T[],
        rowCount: rows.length,
      });
    }

    if (sql.startsWith('INSERT INTO workflow_events')) {
      const row: DbWorkflowEventRow = {
        event_id: params[0] as string,
        repository_id: params[1] as number,
        issue_number: params[2] as number,
        workflow_type: params[3] as string,
        event_type: params[4] as string,
        state_version: params[5] as number,
        payload: params[6] as Record<string, unknown>,
        created_at: params[7] as Date,
      };
      this.workflowEvents.set(row.event_id, row);
      return Promise.resolve({
        rows: [row] as unknown as T[],
        rowCount: 1,
      });
    }

    throw new Error(`Unsupported query in FakePgPool: ${text}`);
  }
}

function makeWorkflowKey(
  repositoryId: number,
  issueNumber: number,
  workflowType: string,
): string {
  return `${repositoryId}:${issueNumber}:${workflowType}`;
}
