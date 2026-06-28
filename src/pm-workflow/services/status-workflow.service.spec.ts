import { Test, TestingModule } from '@nestjs/testing';
import { StatusWorkflowService } from './status-workflow.service';
import { JobService } from '../../job/job.service';
import { IssueStatusContextBuilder } from '../../context/builders/issue-status-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';

describe('StatusWorkflowService', () => {
  let service: StatusWorkflowService;
  let jobService: Partial<JobService>;
  let contextBuilder: Partial<IssueStatusContextBuilder>;
  let aiClient: Partial<AiClient>;
  let policyService: Partial<TriagePolicyService>;
  let githubWriter: Partial<GithubWriter>;

  beforeEach(async () => {
    jobService = {
      updateJobStatus: jest.fn().mockResolvedValue({}),
      recordFailureEvent: jest.fn(),
    };
    contextBuilder = {
      build: jest.fn().mockResolvedValue({}),
    };
    aiClient = {
      status: jest.fn().mockResolvedValue({
        workflow: 'status',
        state: 'in_progress',
        completedWork: [],
        openTasks: [],
        blockers: [],
        nextAction: 'Action',
        commentBody: 'Body',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      }),
      repair: jest.fn(),
    };
    policyService = {
      validateStatus: jest
        .fn()
        .mockReturnValue({ valid: true, commentAllowed: true, warnings: [] }),
    };
    githubWriter = {
      upsertComment: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StatusWorkflowService,
        { provide: JobService, useValue: jobService },
        { provide: IssueStatusContextBuilder, useValue: contextBuilder },
        { provide: AiClient, useValue: aiClient },
        { provide: TriagePolicyService, useValue: policyService },
        { provide: GithubWriter, useValue: githubWriter },
      ],
    }).compile();

    service = module.get<StatusWorkflowService>(StatusWorkflowService);
  });

  it('should successfully execute status workflow', async () => {
    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      workflowType: 'comment.status',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(true);
    expect(githubWriter.upsertComment).toHaveBeenCalled();
  });

  it('should attempt repair on invalid schema', async () => {
    aiClient.status = jest.fn().mockResolvedValue({ workflow: 'invalid' });
    aiClient.repair = jest.fn().mockResolvedValue({
      workflow: 'status',
      state: 'in_progress',
      completedWork: [],
      openTasks: [],
      blockers: [],
      nextAction: 'Repaired',
      commentBody: 'Body',
      confidence: 'high',
      assumptions: [],
      evidence: [],
    });

    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      workflowType: 'comment.status',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(true);
    expect(aiClient.repair).toHaveBeenCalled();
  });

  it('should fail on repair failure', async () => {
    aiClient.status = jest.fn().mockResolvedValue({ workflow: 'invalid' });
    aiClient.repair = jest
      .fn()
      .mockResolvedValue({ workflow: 'still-invalid' });

    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      workflowType: 'comment.status',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(false);
  });
});
