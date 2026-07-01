import { PmWorkflowService } from './pm-workflow.service';
import { JobService } from '../../job/job.service';
import { TriageWorkflowService } from './triage-workflow.service';
import { PlanWorkflowService } from './plan-workflow.service';
import { SplitWorkflowService } from './split-workflow.service';
import { StatusWorkflowService } from './status-workflow.service';
import { BlockerWorkflowService } from './blocker-workflow.service';
import { StopWorkflowService } from './stop-workflow.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { WorkflowStateRepository } from '../../workflow-state/workflow-state.repository';
import { Job } from '../../job/interfaces/job.interface';

describe('PmWorkflowService pause gating', () => {
  let jobService: jest.Mocked<
    Pick<JobService, 'incrementAttempts' | 'updateJobStatus'>
  >;
  let triageWorkflowService: jest.Mocked<
    Pick<TriageWorkflowService, 'execute'>
  >;
  let planWorkflowService: jest.Mocked<Pick<PlanWorkflowService, 'execute'>>;
  let workflowStateRepository: jest.Mocked<
    Pick<WorkflowStateRepository, 'findState'>
  >;
  let service: PmWorkflowService;

  beforeEach(() => {
    jobService = {
      incrementAttempts: jest.fn().mockResolvedValue({}),
      updateJobStatus: jest.fn().mockResolvedValue({}),
    };
    triageWorkflowService = {
      execute: jest.fn().mockResolvedValue({ success: true }),
    };
    planWorkflowService = {
      execute: jest.fn().mockResolvedValue({ success: true }),
    };
    workflowStateRepository = {
      findState: jest.fn().mockResolvedValue(null),
    };

    service = new PmWorkflowService(
      jobService as unknown as JobService,
      triageWorkflowService as unknown as TriageWorkflowService,
      planWorkflowService as unknown as PlanWorkflowService,
      { execute: jest.fn() } as unknown as SplitWorkflowService,
      { execute: jest.fn() } as unknown as StatusWorkflowService,
      { execute: jest.fn() } as unknown as BlockerWorkflowService,
      { execute: jest.fn() } as unknown as StopWorkflowService,
      { upsertComment: jest.fn() } as unknown as GithubWriter,
      workflowStateRepository as unknown as WorkflowStateRepository,
    );
  });

  it('skips automatic issue workflows when the issue has durable pause state', async () => {
    workflowStateRepository.findState.mockResolvedValue({
      repositoryId: 99,
      issueNumber: 7,
      workflowType: 'pause',
      status: 'paused',
      payload: { reason: 'stop_command' },
      stateVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const job = makeJob({ workflowType: 'issue.opened' });
    const result = await service.processJob(job);

    expect(result).toEqual({
      success: true,
      commentWritten: false,
      warnings: ['Issue is paused; automatic workflow skipped'],
    });
    expect(triageWorkflowService.execute).not.toHaveBeenCalled();
    expect(jobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'paused');
  });

  it('allows manual command workflows while the issue is paused', async () => {
    workflowStateRepository.findState.mockResolvedValue({
      repositoryId: 99,
      issueNumber: 7,
      workflowType: 'pause',
      status: 'paused',
      payload: { reason: 'stop_command' },
      stateVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const job = makeJob({ workflowType: 'comment.plan' });
    await service.processJob(job);

    expect(planWorkflowService.execute).toHaveBeenCalledWith(job);
    expect(jobService.updateJobStatus).not.toHaveBeenCalledWith(
      'job-1',
      'paused',
    );
  });

  function makeJob(overrides: Partial<Job>): Job {
    const now = new Date();
    return {
      jobId: 'job-1',
      deliveryId: 'delivery-1',
      status: 'queued',
      attempts: 0,
      workflowType: 'issue.opened',
      createdAt: now,
      updatedAt: now,
      issueNumber: 7,
      repositoryId: 99,
      repositoryOwner: 'MinhWorker',
      repositoryName: 'ruan-ai',
      ...overrides,
    };
  }
});
