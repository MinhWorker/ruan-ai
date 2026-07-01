import { Injectable } from '@nestjs/common';
import {
  WorkflowEvent,
  WorkflowState,
  WorkflowType,
} from './interfaces/workflow-state.interface';
import { WorkflowStateRepository } from './workflow-state.repository';

@Injectable()
export class InMemoryWorkflowStateRepository implements WorkflowStateRepository {
  private readonly states = new Map<string, WorkflowState>();
  private readonly events: WorkflowEvent[] = [];

  saveState(state: WorkflowState): Promise<WorkflowState> {
    const key = makeStateKey(
      state.repositoryId,
      state.issueNumber,
      state.workflowType,
    );
    const existing = this.states.get(key);
    const nextVersion = (existing?.stateVersion ?? 0) + 1;
    const now = new Date();
    const saved = {
      ...state,
      payload: { ...state.payload },
      stateVersion: nextVersion,
      createdAt: existing?.createdAt ?? state.createdAt,
      updatedAt: now,
    };
    this.states.set(key, saved);
    return Promise.resolve(cloneState(saved));
  }

  findState(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowState | null> {
    const state = this.states.get(
      makeStateKey(repositoryId, issueNumber, workflowType),
    );
    return Promise.resolve(state ? cloneState(state) : null);
  }

  appendEvent(event: WorkflowEvent): Promise<WorkflowEvent> {
    const saved = cloneEvent(event);
    this.events.push(saved);
    return Promise.resolve(cloneEvent(saved));
  }

  findEvents(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowEvent[]> {
    return Promise.resolve(
      this.events
        .filter(
          (event) =>
            event.repositoryId === repositoryId &&
            event.issueNumber === issueNumber &&
            event.workflowType === workflowType,
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(cloneEvent),
    );
  }
}

function makeStateKey(
  repositoryId: number,
  issueNumber: number,
  workflowType: WorkflowType,
): string {
  return `${repositoryId}:${issueNumber}:${workflowType}`;
}

function cloneState(state: WorkflowState): WorkflowState {
  return {
    ...state,
    payload: { ...state.payload },
    createdAt: new Date(state.createdAt),
    updatedAt: new Date(state.updatedAt),
  };
}

function cloneEvent(event: WorkflowEvent): WorkflowEvent {
  return {
    ...event,
    payload: { ...event.payload },
    createdAt: new Date(event.createdAt),
  };
}
