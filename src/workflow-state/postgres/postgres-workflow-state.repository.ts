import { Inject, Injectable } from '@nestjs/common';
import type {
  DbWorkflowEventRow,
  DbWorkflowStateRow,
  PgPoolLike,
} from '../../job/postgres/pg-pool';
import { PG_POOL } from '../../job/postgres/pg-pool';
import {
  WorkflowEvent,
  WorkflowState,
  WorkflowStateStatus,
  WorkflowType,
} from '../interfaces/workflow-state.interface';
import { WorkflowStateRepository } from '../workflow-state.repository';

@Injectable()
export class PostgresWorkflowStateRepository implements WorkflowStateRepository {
  constructor(@Inject(PG_POOL) private readonly pool: PgPoolLike) {}

  async saveState(state: WorkflowState): Promise<WorkflowState> {
    const queryText = `
      INSERT INTO workflow_states (
        installation_id, repository_id, repository_owner, repository_name,
        issue_node_id, issue_number, workflow_type, status, payload,
        comment_id, comment_node_id, marker_logical, marker_version,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (repository_id, issue_number, workflow_type) DO UPDATE SET
        installation_id = EXCLUDED.installation_id,
        repository_owner = EXCLUDED.repository_owner,
        repository_name = EXCLUDED.repository_name,
        issue_node_id = EXCLUDED.issue_node_id,
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        comment_id = EXCLUDED.comment_id,
        comment_node_id = EXCLUDED.comment_node_id,
        marker_logical = EXCLUDED.marker_logical,
        marker_version = EXCLUDED.marker_version,
        state_version = workflow_states.state_version + 1,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const now = new Date();
    const params = [
      state.installationId ?? null,
      state.repositoryId,
      state.repositoryOwner ?? null,
      state.repositoryName ?? null,
      state.issueNodeId ?? null,
      state.issueNumber,
      state.workflowType,
      state.status,
      state.payload,
      state.commentId ?? null,
      state.commentNodeId ?? null,
      state.markerLogical ?? null,
      state.markerVersion ?? null,
      state.createdAt,
      now,
    ];

    const res = await this.pool.query<DbWorkflowStateRow>(queryText, params);
    return mapRowToWorkflowState(res.rows[0]);
  }

  async findState(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowState | null> {
    const queryText = `
      SELECT * FROM workflow_states
      WHERE repository_id = $1 AND issue_number = $2 AND workflow_type = $3
    `;
    const res = await this.pool.query<DbWorkflowStateRow>(queryText, [
      repositoryId,
      issueNumber,
      workflowType,
    ]);
    if (res.rowCount === 0) {
      return null;
    }
    return mapRowToWorkflowState(res.rows[0]);
  }

  async appendEvent(event: WorkflowEvent): Promise<WorkflowEvent> {
    const queryText = `
      INSERT INTO workflow_events (
        event_id, repository_id, issue_number, workflow_type, event_type,
        state_version, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const params = [
      event.eventId,
      event.repositoryId,
      event.issueNumber,
      event.workflowType,
      event.eventType,
      event.stateVersion,
      event.payload,
      event.createdAt,
    ];
    const res = await this.pool.query<DbWorkflowEventRow>(queryText, params);
    return mapRowToWorkflowEvent(res.rows[0]);
  }

  async findEvents(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowEvent[]> {
    const queryText = `
      SELECT * FROM workflow_events
      WHERE repository_id = $1 AND issue_number = $2 AND workflow_type = $3
      ORDER BY created_at ASC
    `;
    const res = await this.pool.query<DbWorkflowEventRow>(queryText, [
      repositoryId,
      issueNumber,
      workflowType,
    ]);
    return res.rows.map(mapRowToWorkflowEvent);
  }
}

function mapRowToWorkflowState(row: DbWorkflowStateRow): WorkflowState {
  return {
    installationId: row.installation_id
      ? Number(row.installation_id)
      : undefined,
    repositoryId: Number(row.repository_id),
    repositoryOwner: row.repository_owner ?? undefined,
    repositoryName: row.repository_name ?? undefined,
    issueNodeId: row.issue_node_id ?? undefined,
    issueNumber: Number(row.issue_number),
    workflowType: row.workflow_type as WorkflowType,
    status: row.status as WorkflowStateStatus,
    payload: row.payload,
    commentId: row.comment_id ? Number(row.comment_id) : undefined,
    commentNodeId: row.comment_node_id ?? undefined,
    markerLogical: row.marker_logical ?? undefined,
    markerVersion: row.marker_version ? Number(row.marker_version) : undefined,
    stateVersion: Number(row.state_version),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function mapRowToWorkflowEvent(row: DbWorkflowEventRow): WorkflowEvent {
  return {
    eventId: row.event_id,
    repositoryId: Number(row.repository_id),
    issueNumber: Number(row.issue_number),
    workflowType: row.workflow_type as WorkflowType,
    eventType: row.event_type,
    stateVersion: Number(row.state_version),
    payload: row.payload,
    createdAt: new Date(row.created_at),
  };
}
