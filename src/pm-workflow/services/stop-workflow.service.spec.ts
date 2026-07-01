import { Test, TestingModule } from '@nestjs/testing';
import { StopWorkflowService } from './stop-workflow.service';
import { JobService } from '../../job/job.service';
import { FollowUpService } from '../../job/follow-up.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';
import { WorkflowStateRepository } from '../../workflow-state/workflow-state.repository';
import {
  WorkflowEvent,
  WorkflowState,
} from '../../workflow-state/interfaces/workflow-state.interface';

describe('StopWorkflowService', () => {
  let service: StopWorkflowService;
  let jobService: Partial<JobService>;
  let followUpService: Partial<FollowUpService>;
  let githubWriter: Partial<GithubWriter>;
  let workflowStateRepository: jest.Mocked<WorkflowStateRepository>;
  let saveState: jest.MockedFunction<WorkflowStateRepository['saveState']>;
  let appendEvent: jest.MockedFunction<WorkflowStateRepository['appendEvent']>;

  beforeEach(async () => {
    jobService = {
      updateJobStatus: jest.fn().mockResolvedValue({}),
      recordFailureEvent: jest.fn(),
    };
    followUpService = {
      cancelPendingForIssue: jest.fn().mockResolvedValue(undefined),
    };
    githubWriter = {
      upsertComment: jest.fn().mockResolvedValue(undefined),
    };
    saveState = jest.fn(
      (state: WorkflowState): Promise<WorkflowState> =>
        Promise.resolve({
          ...state,
          stateVersion: 1,
        }),
    );
    appendEvent = jest.fn(
      (event: WorkflowEvent): Promise<WorkflowEvent> => Promise.resolve(event),
    );
    workflowStateRepository = {
      saveState,
      findState: jest.fn(),
      appendEvent,
      findEvents: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StopWorkflowService,
        { provide: JobService, useValue: jobService },
        { provide: FollowUpService, useValue: followUpService },
        { provide: GithubWriter, useValue: githubWriter },
        { provide: WorkflowStateRepository, useValue: workflowStateRepository },
      ],
    }).compile();

    service = module.get<StopWorkflowService>(StopWorkflowService);
  });

  it('should successfully execute stop workflow and cancel follow ups', async () => {
    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      repositoryId: 99,
      installationId: 123,
    } as unknown as Job;
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(followUpService.cancelPendingForIssue).toHaveBeenCalledWith(
      1,
      'o',
      'r',
    );
    expect(githubWriter.upsertComment).toHaveBeenCalled();
    expect(jobService.updateJobStatus).toHaveBeenCalledWith('1', 'paused');

    const savedState = saveState.mock.calls[0]?.[0];
    expect(savedState).toMatchObject({
      installationId: 123,
      repositoryId: 99,
      repositoryOwner: 'o',
      repositoryName: 'r',
      issueNumber: 1,
      workflowType: 'pause',
      status: 'paused',
      markerLogical: 'paused',
    });
    expect(savedState?.payload).toMatchObject({
      reason: 'stop_command',
      manualCommandsAllowed: true,
    });

    const appendedEvent = appendEvent.mock.calls[0]?.[0];
    expect(appendedEvent).toMatchObject({
      repositoryId: 99,
      issueNumber: 1,
      workflowType: 'pause',
      eventType: 'state_transition',
    });
    expect(appendedEvent?.payload).toMatchObject({
      to: 'paused',
      reason: 'stop_command',
    });
  });
});
