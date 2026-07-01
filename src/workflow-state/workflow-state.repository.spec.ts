import { InMemoryWorkflowStateRepository } from './in-memory-workflow-state.repository';
import { WorkflowState } from './interfaces/workflow-state.interface';
import { FakePgPool } from '../job/postgres/fake-pg-pool';
import { PostgresWorkflowStateRepository } from './postgres/postgres-workflow-state.repository';

describe('InMemoryWorkflowStateRepository', () => {
  it('upserts workflow state by repository, issue, and workflow with a monotonic state version', async () => {
    const repository = new InMemoryWorkflowStateRepository();
    const now = new Date('2026-06-30T10:00:00.000Z');

    const state: WorkflowState = {
      installationId: 10,
      repositoryId: 20,
      repositoryOwner: 'MinhWorker',
      repositoryName: 'ruan-ai',
      issueNodeId: 'I_kwD',
      issueNumber: 23,
      workflowType: 'plan',
      status: 'completed',
      payload: { assumptions: ['schema first'] },
      commentId: 100,
      commentNodeId: 'IC_kwD',
      markerLogical: 'active-plan',
      markerVersion: 1,
      stateVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await repository.saveState(state);
    expect(saved.stateVersion).toBe(1);

    const updated = await repository.saveState({
      ...saved,
      status: 'waiting_human',
      payload: { question: 'Which database migration runner?' },
    });

    expect(updated.stateVersion).toBe(2);

    const fetched = await repository.findState(20, 23, 'plan');
    expect(fetched).toMatchObject({
      repositoryId: 20,
      issueNumber: 23,
      workflowType: 'plan',
      status: 'waiting_human',
      stateVersion: 2,
      markerLogical: 'active-plan',
    });
  });

  it('stores workflow events in append-only order for audit', async () => {
    const repository = new InMemoryWorkflowStateRepository();
    const now = new Date('2026-06-30T10:00:00.000Z');

    await repository.appendEvent({
      eventId: 'event-1',
      repositoryId: 20,
      issueNumber: 23,
      workflowType: 'plan',
      eventType: 'hydrated_from_github',
      stateVersion: 1,
      payload: { markerLogical: 'active-plan' },
      createdAt: now,
    });
    await repository.appendEvent({
      eventId: 'event-2',
      repositoryId: 20,
      issueNumber: 23,
      workflowType: 'plan',
      eventType: 'state_transition',
      stateVersion: 2,
      payload: { from: 'running', to: 'completed' },
      createdAt: new Date(now.getTime() + 1000),
    });

    const events = await repository.findEvents(20, 23, 'plan');
    expect(events.map((event) => event.eventId)).toEqual([
      'event-1',
      'event-2',
    ]);
    expect(events[1].payload).toEqual({ from: 'running', to: 'completed' });
  });
});

describe('PostgresWorkflowStateRepository', () => {
  it('persists workflow state and events across repository instance recreation', async () => {
    const pool = new FakePgPool();
    const repositoryOne = new PostgresWorkflowStateRepository(pool);
    const now = new Date('2026-06-30T10:00:00.000Z');

    await repositoryOne.saveState({
      installationId: 10,
      repositoryId: 20,
      repositoryOwner: 'MinhWorker',
      repositoryName: 'ruan-ai',
      issueNodeId: 'I_kwD',
      issueNumber: 23,
      workflowType: 'split',
      status: 'completed',
      payload: { tasks: ['schema', 'repository'] },
      commentId: 101,
      commentNodeId: 'IC_kwD',
      markerLogical: 'split-result',
      markerVersion: 1,
      stateVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    await repositoryOne.appendEvent({
      eventId: 'event-1',
      repositoryId: 20,
      issueNumber: 23,
      workflowType: 'split',
      eventType: 'comment_upserted',
      stateVersion: 1,
      payload: { commentId: 101 },
      createdAt: now,
    });

    const repositoryTwo = new PostgresWorkflowStateRepository(pool);
    const fetched = await repositoryTwo.findState(20, 23, 'split');
    const events = await repositoryTwo.findEvents(20, 23, 'split');

    expect(fetched).toMatchObject({
      repositoryId: 20,
      issueNumber: 23,
      workflowType: 'split',
      status: 'completed',
      stateVersion: 1,
      markerLogical: 'split-result',
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventId: 'event-1',
      eventType: 'comment_upserted',
      payload: { commentId: 101 },
    });
  });
});
