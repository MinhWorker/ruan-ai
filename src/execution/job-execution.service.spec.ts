/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { JobExecutionService } from './job-execution.service';
import { ConfigService } from '../config/config.service';
import { PmWorkflowService } from '../pm-workflow/services/pm-workflow.service';
import { JobService } from '../job/job.service';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { Job } from '../job/interfaces/job.interface';

describe('JobExecutionService', () => {
  let service: JobExecutionService;
  let configService: jest.Mocked<ConfigService>;
  let pmWorkflowService: jest.Mocked<PmWorkflowService>;
  let jobService: jest.Mocked<JobService>;
  let telemetryService: jest.Mocked<TelemetryService>;

  beforeEach(async () => {
    configService = {
      get jobExecutionMode() {
        return 'queued';
      },
    } as any;

    pmWorkflowService = {
      processJob: jest.fn(),
    } as any;

    jobService = {
      updateJobStatus: jest.fn(),
      incrementAttempts: jest.fn(),
    } as any;

    telemetryService = {
      recordEvent: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobExecutionService,
        { provide: ConfigService, useValue: configService },
        { provide: PmWorkflowService, useValue: pmWorkflowService },
        { provide: JobService, useValue: jobService },
        { provide: TelemetryService, useValue: telemetryService },
      ],
    }).compile();

    service = module.get<JobExecutionService>(JobExecutionService);
  });

  const mockJob: Job = {
    jobId: 'test-job-1',
    deliveryId: 'test-delivery-1',
    status: 'queued',
    attempts: 0,
    workflowType: 'issue.opened',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should skip execution when mode is queued', async () => {
    jest
      .spyOn(configService, 'jobExecutionMode', 'get')
      .mockReturnValue('queued');

    const result = await service.executeJob(mockJob);

    expect(result.mode).toBe('queued');
    expect(pmWorkflowService.processJob).not.toHaveBeenCalled();
    expect(telemetryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_lifecycle' }),
    );
  });

  it('should call PmWorkflowService.processJob when mode is inline', async () => {
    jest
      .spyOn(configService, 'jobExecutionMode', 'get')
      .mockReturnValue('inline');

    const result = await service.executeJob(mockJob);

    expect(result.mode).toBe('inline');
    expect(result.success).toBe(true);
    expect(pmWorkflowService.processJob).toHaveBeenCalledWith(mockJob);
    expect(jobService.updateJobStatus).not.toHaveBeenCalled();
    expect(jobService.incrementAttempts).not.toHaveBeenCalled();
    expect(telemetryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'job_lifecycle' }),
    );
  });

  it('should treat unsuccessful workflow results as failed execution', async () => {
    jest
      .spyOn(configService, 'jobExecutionMode', 'get')
      .mockReturnValue('inline');
    pmWorkflowService.processJob.mockResolvedValue({
      success: false,
      error: 'Workflow rejected by policy',
      warnings: [],
      commentWritten: false,
    });

    const result = await service.executeJob(mockJob);

    expect(result.mode).toBe('inline');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Job execution failed');
    expect(jobService.updateJobStatus).toHaveBeenCalledWith(
      mockJob.jobId,
      'failed',
    );
    expect(telemetryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_lifecycle',
        severity: 'error',
        message: expect.stringContaining('Workflow rejected by policy'),
      }),
    );
  });

  it('should mark job failed and record telemetry if processJob throws', async () => {
    jest
      .spyOn(configService, 'jobExecutionMode', 'get')
      .mockReturnValue('inline');
    pmWorkflowService.processJob.mockRejectedValue(new Error('Test error'));

    const result = await service.executeJob(mockJob);

    expect(result.mode).toBe('inline');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Job execution failed');
    expect(jobService.updateJobStatus).toHaveBeenCalledWith(
      mockJob.jobId,
      'failed',
    );
    expect(telemetryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'job_lifecycle',
        severity: 'error',
        message: expect.stringContaining('Test error'),
      }),
    );
  });
});
