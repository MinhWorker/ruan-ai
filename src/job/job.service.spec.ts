import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { JobRepository } from './job.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';

describe('JobService', () => {
  let service: JobService;
  let repository: JobRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
    repository = module.get<JobRepository>(JobRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createJob', () => {
    it('should create a new job and return it', async () => {
      const job = await service.createJob({
        deliveryId: 'dlv-123',
        workflowType: 'issues.opened',
        issueNumber: 42,
        repositoryId: 999,
        installationId: 111,
      });

      expect(job).toBeDefined();
      expect(job.deliveryId).toBe('dlv-123');
      expect(job.status).toBe('queued');
      expect(job.attempts).toBe(0);
      expect(job.issueNumber).toBe(42);
      expect(job.repositoryId).toBe(999);
      expect(job.installationId).toBe(111);

      const saved = await repository.findByDeliveryId('dlv-123');
      expect(saved).not.toBeNull();
      expect(saved?.jobId).toBe(job.jobId);
    });

    it('should deduplicate and return existing job on matching deliveryId', async () => {
      const firstJob = await service.createJob({
        deliveryId: 'dlv-duplicate',
        workflowType: 'issues.opened',
      });

      const secondJob = await service.createJob({
        deliveryId: 'dlv-duplicate',
        workflowType: 'issues.edited', // different type but same deliveryId
      });

      expect(secondJob.jobId).toBe(firstJob.jobId);
      expect(secondJob.workflowType).toBe('issues.opened'); // should keep original values
      const allJobs = await repository.findAll();
      expect(allJobs.length).toBe(1);
    });
  });

  describe('updateJobStatus', () => {
    it('should update job status successfully', async () => {
      const job = await service.createJob({
        deliveryId: 'dlv-status',
        workflowType: 'issue_comment.created',
      });

      const updated = await service.updateJobStatus(job.jobId, 'running');
      expect(updated.status).toBe('running');

      const fetched = await repository.findById(job.jobId);
      expect(fetched?.status).toBe('running');
    });

    it('should throw when updating status of non-existent job', async () => {
      await expect(
        service.updateJobStatus('non-existent', 'completed'),
      ).rejects.toThrow();
    });
  });

  describe('incrementAttempts', () => {
    it('should increment attempts by 1', async () => {
      const job = await service.createJob({
        deliveryId: 'dlv-attempts',
        workflowType: 'issues.opened',
      });

      const updated = await service.incrementAttempts(job.jobId);
      expect(updated.attempts).toBe(1);

      const fetched = await repository.findById(job.jobId);
      expect(fetched?.attempts).toBe(1);
    });
  });
});
