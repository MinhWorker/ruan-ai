import { PostgresJobRepository } from './postgres-job.repository';
import { PostgresFollowUpRecordRepository } from './postgres-follow-up-record.repository';
import { InMemoryJobRepository } from '../in-memory-job.repository';
import { InMemoryFollowUpRecordRepository } from '../in-memory-follow-up-record.repository';
import { FakePgPool } from './fake-pg-pool';
import { Job } from '../interfaces/job.interface';
import { FollowUpRecord } from '../interfaces/follow-up-record.interface';

describe('Postgres Persistence & Memory Determinism', () => {
  let fakePool: FakePgPool;

  beforeEach(() => {
    fakePool = new FakePgPool();
  });

  describe('PostgresJobRepository', () => {
    it('should save a job and retrieve it by ID and delivery ID', async () => {
      const repo = new PostgresJobRepository(fakePool);
      const now = new Date();

      const job: Job = {
        jobId: 'job-1',
        deliveryId: 'delivery-1',
        status: 'queued',
        attempts: 1,
        workflowType: 'triage',
        createdAt: now,
        updatedAt: now,
        issueNumber: 42,
        repositoryId: 100,
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        senderLogin: 'sender',
        commentId: 200,
        commentBody: 'hello',
        installationId: 300,
      };

      const saved = await repo.save(job);
      expect(saved.jobId).toBe('job-1');
      expect(saved.deliveryId).toBe('delivery-1');
      expect(saved.status).toBe('queued');
      expect(saved.attempts).toBe(1);
      expect(saved.issueNumber).toBe(42);
      expect(saved.repositoryId).toBe(100);

      const fetchedById = await repo.findById('job-1');
      expect(fetchedById).not.toBeNull();
      expect(fetchedById!.deliveryId).toBe('delivery-1');

      const fetchedByDeliveryId = await repo.findByDeliveryId('delivery-1');
      expect(fetchedByDeliveryId).not.toBeNull();
      expect(fetchedByDeliveryId!.jobId).toBe('job-1');
    });

    it('should allow delivery ID dedupe to work and survive repository instance recreation', async () => {
      const repoInstance1 = new PostgresJobRepository(fakePool);
      const now = new Date();

      const job: Job = {
        jobId: 'job-dedupe',
        deliveryId: 'delivery-unique',
        status: 'queued',
        attempts: 1,
        workflowType: 'triage',
        createdAt: now,
        updatedAt: now,
      };

      await repoInstance1.save(job);

      // Recreate repository instance simulating server/instance restart
      const repoInstance2 = new PostgresJobRepository(fakePool);

      const fetched = await repoInstance2.findByDeliveryId('delivery-unique');
      expect(fetched).not.toBeNull();
      expect(fetched!.jobId).toBe('job-dedupe');
    });

    it('should ensure job status and attempts survive repository instance recreation', async () => {
      const repoInstance1 = new PostgresJobRepository(fakePool);
      const now = new Date();

      const job: Job = {
        jobId: 'job-update',
        deliveryId: 'delivery-update',
        status: 'queued',
        attempts: 1,
        workflowType: 'triage',
        createdAt: now,
        updatedAt: now,
      };

      await repoInstance1.save(job);

      // Update the job status and attempts
      const updatedJob: Job = {
        ...job,
        status: 'completed',
        attempts: 3,
      };
      await repoInstance1.save(updatedJob);

      // Recreate repository instance
      const repoInstance2 = new PostgresJobRepository(fakePool);

      const fetched = await repoInstance2.findById('job-update');
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe('completed');
      expect(fetched!.attempts).toBe(3);
    });

    it('should find all jobs', async () => {
      const repo = new PostgresJobRepository(fakePool);
      const now = new Date();

      await repo.save({
        jobId: 'job-1',
        deliveryId: 'd-1',
        status: 'queued',
        attempts: 1,
        workflowType: 'triage',
        createdAt: now,
        updatedAt: now,
      });

      await repo.save({
        jobId: 'job-2',
        deliveryId: 'd-2',
        status: 'completed',
        attempts: 1,
        workflowType: 'plan',
        createdAt: now,
        updatedAt: now,
      });

      const all = await repo.findAll();
      expect(all.length).toBe(2);
      expect(all.map((j) => j.jobId)).toContain('job-1');
      expect(all.map((j) => j.jobId)).toContain('job-2');
    });
  });

  describe('PostgresFollowUpRecordRepository', () => {
    it('should save a record and retrieve it by ID', async () => {
      const repo = new PostgresFollowUpRecordRepository(fakePool);
      const now = new Date();

      const record: FollowUpRecord = {
        id: 'rec-1',
        issueNumber: 5,
        repositoryId: 101,
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        workflow: 'plan',
        dueAt: new Date(now.getTime() + 10000),
        status: 'pending',
        reason: 'test reason',
        createdAt: now,
        updatedAt: now,
      };

      const saved = await repo.save(record);
      expect(saved.id).toBe('rec-1');
      expect(saved.status).toBe('pending');

      const fetched = await repo.findById('rec-1');
      expect(fetched).not.toBeNull();
      expect(fetched!.reason).toBe('test reason');
    });

    it('should survive repository instance recreation and support queries by issue and status', async () => {
      const repoInstance1 = new PostgresFollowUpRecordRepository(fakePool);
      const now = new Date();

      const recordPending: FollowUpRecord = {
        id: 'rec-pending',
        issueNumber: 42,
        repositoryId: 100,
        repositoryOwner: 'minh',
        repositoryName: 'test-repo',
        workflow: 'plan',
        dueAt: new Date(now.getTime() + 5000),
        status: 'pending',
        reason: 'due soon',
        createdAt: now,
        updatedAt: now,
      };

      const recordCompleted: FollowUpRecord = {
        id: 'rec-completed',
        issueNumber: 42,
        repositoryId: 100,
        repositoryOwner: 'minh',
        repositoryName: 'test-repo',
        workflow: 'plan',
        dueAt: new Date(now.getTime() - 5000),
        status: 'completed',
        reason: 'finished',
        createdAt: now,
        updatedAt: now,
      };

      await repoInstance1.save(recordPending);
      await repoInstance1.save(recordCompleted);

      // Recreate repository instance
      const repoInstance2 = new PostgresFollowUpRecordRepository(fakePool);

      const allByIssue = await repoInstance2.findByIssue(
        42,
        'minh',
        'test-repo',
      );
      expect(allByIssue.length).toBe(2);

      const pendingOnly = await repoInstance2.findPendingByIssue(
        42,
        'minh',
        'test-repo',
      );
      expect(pendingOnly.length).toBe(1);
      expect(pendingOnly[0].id).toBe('rec-pending');

      const due = await repoInstance2.findPendingDueBefore(
        new Date(now.getTime() + 10000),
      );
      expect(due.map((record) => record.id)).toEqual(['rec-pending']);
    });

    it('should update status and survive repository instance recreation', async () => {
      const repoInstance1 = new PostgresFollowUpRecordRepository(fakePool);
      const now = new Date();

      const record: FollowUpRecord = {
        id: 'rec-status-update',
        issueNumber: 10,
        workflow: 'blocker',
        dueAt: now,
        status: 'pending',
        reason: 'need verification',
        createdAt: now,
        updatedAt: now,
      };

      await repoInstance1.save(record);
      await repoInstance1.updateStatus('rec-status-update', 'completed');

      // Recreate repository instance
      const repoInstance2 = new PostgresFollowUpRecordRepository(fakePool);

      const fetched = await repoInstance2.findById('rec-status-update');
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe('completed');
    });
  });

  describe('InMemoryRepositories Determinism', () => {
    it('should maintain independent state across different InMemoryJobRepository instances', async () => {
      const repo1 = new InMemoryJobRepository();
      const repo2 = new InMemoryJobRepository();
      const now = new Date();

      const job: Job = {
        jobId: 'j-memory',
        deliveryId: 'd-memory',
        status: 'queued',
        attempts: 1,
        workflowType: 'triage',
        createdAt: now,
        updatedAt: now,
      };

      await repo1.save(job);

      const fetched1 = await repo1.findById('j-memory');
      expect(fetched1).not.toBeNull();

      const fetched2 = await repo2.findById('j-memory');
      expect(fetched2).toBeNull(); // remains deterministic & isolated
    });

    it('should maintain independent state across different InMemoryFollowUpRecordRepository instances', async () => {
      const repo1 = new InMemoryFollowUpRecordRepository();
      const repo2 = new InMemoryFollowUpRecordRepository();
      const now = new Date();

      const record: FollowUpRecord = {
        id: 'rec-memory',
        issueNumber: 1,
        workflow: 'plan',
        dueAt: now,
        status: 'pending',
        reason: 'isolated test',
        createdAt: now,
        updatedAt: now,
      };

      await repo1.save(record);

      const fetched1 = await repo1.findById('rec-memory');
      expect(fetched1).not.toBeNull();

      const fetched2 = await repo2.findById('rec-memory');
      expect(fetched2).toBeNull(); // remains deterministic & isolated
    });
  });
});
