import { Test, TestingModule } from '@nestjs/testing';
import { PlanWorkflowService } from './plan-workflow.service';
import { JobService } from '../../job/job.service';
import { JobRepository } from '../../job/job.repository';
import { InMemoryJobRepository } from '../../job/in-memory-job.repository';
import { IssuePlanContextBuilder } from '../../context/builders/issue-plan-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { FakeTriageAiClient } from '../../ai/fake/fake-triage-ai-client';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { FakeGithubWriter } from '../../github-writer/fake/fake-github-writer';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';
import { Job } from '../../job/interfaces/job.interface';
import { PlanOutput } from '../../ai/interfaces/plan-output.interface';

describe('PlanWorkflowService', () => {
  let service: PlanWorkflowService;
  let jobService: JobService;
  let writer: FakeGithubWriter;
  let githubClient: FakeGithubClient;
  let aiClient: FakeTriageAiClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanWorkflowService,
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
        IssuePlanContextBuilder,
        {
          provide: GithubClient,
          useClass: FakeGithubClient,
        },
        {
          provide: AiClient,
          useClass: FakeTriageAiClient,
        },
        TriagePolicyService,
        {
          provide: GithubWriter,
          useClass: FakeGithubWriter,
        },
      ],
    }).compile();

    service = module.get<PlanWorkflowService>(PlanWorkflowService);
    jobService = module.get<JobService>(JobService);
    writer = module.get<GithubWriter>(GithubWriter) as FakeGithubWriter;
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
    aiClient = module.get<AiClient>(AiClient) as FakeTriageAiClient;
  });

  async function createPlanJob(issueNumber: number): Promise<Job> {
    return jobService.createJob({
      deliveryId: `dlv-plan-${issueNumber}-${Date.now()}`,
      workflowType: 'comment.plan',
      issueNumber,
      repositoryId: 12345,
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      senderLogin: 'reporter',
    });
  }

  it('should execute plan successfully and upsert plan comment with marker', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 1,
      title: 'Implement Milestone 3',
      body: 'We need to implement the planning and splitting workflow.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    const job = await createPlanJob(1);
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(result.commentWritten).toBe(true);

    const comment = writer.getComment(
      'owner',
      'repo',
      1,
      '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 -->',
    );
    expect(comment).toBeDefined();
    expect(comment).toContain('## Proposed Plan');
    expect(comment).toContain(
      'ruan-ai:workflow=plan issue=1 logical=active-plan version=1',
    );
  });

  it('should trigger repair retry on schema validation failure and succeed if repair succeeds', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 2,
      title: 'Fix issue',
      body: 'Do something.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    // Mock first AI response to be invalid
    let callCount = 0;
    jest.spyOn(aiClient, 'plan').mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        workflow: 'plan',
        problemStatement: '',
      } as PlanOutput); // problemStatement is empty -> invalid!
    });

    aiClient.setRepairBehavior((errors, summary) => {
      expect(errors).toContain('problemStatement must be a non-empty string');
      expect(summary).toContain('Planning workflow for repository owner/repo');
      return {
        workflow: 'plan',
        problemStatement: 'Repaired problem statement.',
        scope: ['fixed'],
        nonScope: [],
        dependencies: [],
        taskSequence: ['repaired task'],
        acceptanceCriteria: [],
        verificationStrategy: 'Repaired strategy.',
        humanDecisions: [],
        commentBody: 'Repaired plan proposed.',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      } as PlanOutput;
    });

    const job = await createPlanJob(2);
    const result = await service.execute(job);

    expect(callCount).toBe(1);
    expect(result.success).toBe(true);
    expect(result.commentWritten).toBe(true);

    const updatedJob = await jobService.getJobByDeliveryId(job.deliveryId);
    expect(updatedJob?.status).toBe('completed');
  });

  it('should fail if repair retry also returns invalid schema output', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 3,
      title: 'Fix issue',
      body: 'Do something.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    jest.spyOn(aiClient, 'plan').mockImplementation(() => {
      return Promise.resolve({
        workflow: 'plan',
        problemStatement: '',
      } as PlanOutput);
    });

    aiClient.setRepairBehavior(() => {
      return {
        workflow: 'plan',
        problemStatement: '',
      } as PlanOutput; // Still empty -> invalid!
    });

    const job = await createPlanJob(3);
    const result = await service.execute(job);

    expect(result.success).toBe(false);
    expect(result.commentWritten).toBe(false);
    expect(result.error).toContain('AI plan repair retry failed');

    const updatedJob = await jobService.getJobByDeliveryId(job.deliveryId);
    expect(updatedJob?.status).toBe('failed');
  });
});
