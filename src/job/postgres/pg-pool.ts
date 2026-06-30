export const PG_POOL = 'PG_POOL';

export interface PgQueryResult<T> {
  rows: T[];
  rowCount: number | null;
}

export interface PgPoolLike {
  query<T = unknown>(
    text: string,
    params?: unknown[],
  ): Promise<PgQueryResult<T>>;
  end?: () => Promise<void>;
}

export interface DbJobRow {
  job_id: string;
  delivery_id: string;
  status: string;
  attempts: number;
  workflow_type: string;
  created_at: Date;
  updated_at: Date;
  issue_number: number | null;
  repository_id: number | null;
  repository_owner: string | null;
  repository_name: string | null;
  sender_login: string | null;
  comment_id: number | null;
  comment_body: string | null;
  installation_id: number | null;
}

export interface DbFollowUpRow {
  id: string;
  issue_number: number;
  repository_id: number | null;
  repository_owner: string | null;
  repository_name: string | null;
  workflow: string;
  due_at: Date;
  status: string;
  reason: string;
  created_at: Date;
  updated_at: Date;
}
