import { Test, TestingModule } from '@nestjs/testing';
import { JobService } from './job.service';
import { JobRepository } from './job.repository';
import { InMemoryJobRepository } from './in-memory-job.repository';
import { TelemetryService } from '../telemetry/services/telemetry.service';

describe('JobService', () => {
  let service: JobService;
  let repository: JobRepository;
  let telemetryService: jest.Mocked<Pick<TelemetryService, 'recordEvent'>>;

  beforeEach(async () => {
    telemetryService = {
      recordEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
        {
          provide: TelemetryService,
          useValue: telemetryService,
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
        repositoryOwner: 'octo-org',
        repositoryName: 'octo-repo',
        senderLogin: 'octocat',
        commentId: 123,
        commentBody: '/blocker this is blocked',
        installationId: 111,
      });

      expect(job).toBeDefined();
      expect(job.deliveryId).toBe('dlv-123');
      expect(job.status).toBe('queued');
      expect(job.attempts).toBe(0);
      expect(job.issueNumber).toBe(42);
      expect(job.repositoryId).toBe(999);
      expect(job.repositoryOwner).toBe('octo-org');
      expect(job.repositoryName).toBe('octo-repo');
      expect(job.senderLogin).toBe('octocat');
      expect(job.commentId).toBe(123);
      expect(job.commentBody).toBe('/blocker this is blocked');
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

  describe('recordFailureEvent', () => {
    it('should record validation failures with failure category metadata', () => {
      service.recordFailureEvent(
        'job-1',
        'schema_validation_failure',
        'Invalid status output',
      );

      expect(telemetryService.recordEvent).toHaveBeenCalledWith({
        type: 'validation_failure',
        severity: 'error',
        jobId: 'job-1',
        message: 'Invalid status output',
        metadata: { failureCategory: 'schema_validation_failure' },
      });
    });

    it('should record github write failures as github_write events', () => {
      service.recordFailureEvent(
        'job-2',
        'github_write_failure',
        'Write failed',
      );

      expect(telemetryService.recordEvent).toHaveBeenCalledWith({
        type: 'github_write',
        severity: 'error',
        jobId: 'job-2',
        message: 'Write failed',
        metadata: { failureCategory: 'github_write_failure' },
      });
    });
  });
});
