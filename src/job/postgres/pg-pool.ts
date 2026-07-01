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

export interface DbWorkflowStateRow {
  installation_id: number | null;
  repository_id: number;
  repository_owner: string | null;
  repository_name: string | null;
  issue_node_id: string | null;
  issue_number: number;
  workflow_type: string;
  status: string;
  payload: Record<string, unknown>;
  comment_id: number | null;
  comment_node_id: string | null;
  marker_logical: string | null;
  marker_version: number | null;
  state_version: number;
  created_at: Date;
  updated_at: Date;
}

export interface DbWorkflowEventRow {
  event_id: string;
  repository_id: number;
  issue_number: number;
  workflow_type: string;
  event_type: string;
  state_version: number;
  payload: Record<string, unknown>;
  created_at: Date;
}
