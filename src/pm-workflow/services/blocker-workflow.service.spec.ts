import { Test, TestingModule } from '@nestjs/testing';
import { BlockerWorkflowService } from './blocker-workflow.service';
import { JobService } from '../../job/job.service';
import { IssueBlockerContextBuilder } from '../../context/builders/issue-blocker-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { Job } from '../../job/interfaces/job.interface';

describe('BlockerWorkflowService', () => {
  let service: BlockerWorkflowService;
  let jobService: Partial<JobService>;
  let contextBuilder: Partial<IssueBlockerContextBuilder>;
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
      blocker: jest.fn().mockResolvedValue({
        workflow: 'blocker',
        summary: 'sum',
        nextProvingMethod: 'meth',
        directHumanQuestions: [],
        commentBody: 'Body',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      }),
      repair: jest.fn(),
    };
    policyService = {
      validateBlocker: jest
        .fn()
        .mockReturnValue({ valid: true, commentAllowed: true, warnings: [] }),
    };
    githubWriter = {
      upsertComment: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockerWorkflowService,
        { provide: JobService, useValue: jobService },
        { provide: IssueBlockerContextBuilder, useValue: contextBuilder },
        { provide: AiClient, useValue: aiClient },
        { provide: TriagePolicyService, useValue: policyService },
        { provide: GithubWriter, useValue: githubWriter },
      ],
    }).compile();

    service = module.get<BlockerWorkflowService>(BlockerWorkflowService);
  });

  it('should successfully execute blocker workflow', async () => {
    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      commentBody: '/blocker trigger body',
      workflowType: 'comment.blocker',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(true);
    expect(contextBuilder.build).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      issueNumber: 1,
      senderLogin: '',
      triggeringCommentBody: '/blocker trigger body',
    });
    expect(githubWriter.upsertComment).toHaveBeenCalled();
  });

  it('should attempt repair on invalid schema', async () => {
    aiClient.blocker = jest.fn().mockResolvedValue({ workflow: 'invalid' });
    aiClient.repair = jest.fn().mockResolvedValue({
      workflow: 'blocker',
      summary: 'rep',
      nextProvingMethod: 'rep',
      directHumanQuestions: [],
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
      workflowType: 'comment.blocker',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(true);
    expect(aiClient.repair).toHaveBeenCalled();
  });

  it('should fail on repair failure', async () => {
    aiClient.blocker = jest.fn().mockResolvedValue({ workflow: 'invalid' });
    aiClient.repair = jest
      .fn()
      .mockResolvedValue({ workflow: 'still-invalid' });

    const job = {
      jobId: '1',
      issueNumber: 1,
      repositoryOwner: 'o',
      repositoryName: 'r',
      workflowType: 'comment.blocker',
    } as unknown as Job;
    const result = await service.execute(job);
    expect(result.success).toBe(false);
  });
});
