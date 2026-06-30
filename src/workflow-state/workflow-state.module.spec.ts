import { Test } from '@nestjs/testing';
import { InMemoryWorkflowStateRepository } from './in-memory-workflow-state.repository';
import { PostgresWorkflowStateRepository } from './postgres/postgres-workflow-state.repository';
import { WorkflowStateModule } from './workflow-state.module';
import { WorkflowStateRepository } from './workflow-state.repository';

describe('WorkflowStateModule storage wiring', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses the in-memory workflow-state repository by default', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    delete process.env.JOB_STORAGE_MODE;
    delete process.env.DATABASE_URL;

    const module = await Test.createTestingModule({
      imports: [WorkflowStateModule],
    }).compile();

    expect(module.get(WorkflowStateRepository)).toBeInstanceOf(
      InMemoryWorkflowStateRepository,
    );
  });

  it('uses the Postgres workflow-state repository when JOB_STORAGE_MODE=postgres', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.JOB_STORAGE_MODE = 'postgres';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    const module = await Test.createTestingModule({
      imports: [WorkflowStateModule],
    }).compile();

    expect(module.get(WorkflowStateRepository)).toBeInstanceOf(
      PostgresWorkflowStateRepository,
    );
  });
});
