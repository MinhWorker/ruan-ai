import { Test } from '@nestjs/testing';
import { JobModule } from './job.module';
import { JobRepository } from './job.repository';
import { FollowUpRecordRepository } from './follow-up-record.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';
import { InMemoryFollowUpRecordRepository } from './in-memory-follow-up-record.repository';
import { PostgresJobRepository } from './postgres/postgres-job.repository';
import { PostgresFollowUpRecordRepository } from './postgres/postgres-follow-up-record.repository';

describe('JobModule storage wiring', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('uses in-memory repositories by default', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    delete process.env.JOB_STORAGE_MODE;
    delete process.env.DATABASE_URL;

    const module = await Test.createTestingModule({
      imports: [JobModule],
    }).compile();

    expect(module.get(JobRepository)).toBeInstanceOf(InMemoryJobRepository);
    expect(module.get(FollowUpRecordRepository)).toBeInstanceOf(
      InMemoryFollowUpRecordRepository,
    );
  });

  it('uses Postgres repositories when JOB_STORAGE_MODE=postgres', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.JOB_STORAGE_MODE = 'postgres';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    const module = await Test.createTestingModule({
      imports: [JobModule],
    }).compile();

    expect(module.get(JobRepository)).toBeInstanceOf(PostgresJobRepository);
    expect(module.get(FollowUpRecordRepository)).toBeInstanceOf(
      PostgresFollowUpRecordRepository,
    );
  });
});
