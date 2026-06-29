import { Test, TestingModule } from '@nestjs/testing';
import { TriageWorkflowService } from './triage-workflow.service';
import { JobService } from '../../job/job.service';
import { JobRepository } from '../../job/job.repository';
import { InMemoryJobRepository } from '../../job/in-memory-job.repository';
import { IssueTriageContextBuilder } from '../../context/builders/issue-triage-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { FakeTriageAiClient } from '../../ai/fake/fake-triage-ai-client';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { FakeGithubWriter } from '../../github-writer/fake/fake-github-writer';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';
import { Job } from '../../job/interfaces/job.interface';
import { TriageOutput } from '../../ai/interfaces/triage-output.interface';

describe('TriageWorkflowService', () => {
  let service: TriageWorkflowService;
  let jobService: JobService;
  let writer: FakeGithubWriter;
  let githubClient: FakeGithubClient;
  let aiClient: AiClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageWorkflowService,
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
        IssueTriageContextBuilder,
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

    service = module.get<TriageWorkflowService>(TriageWorkflowService);
    jobService = module.get<JobService>(JobService);
    writer = module.get<GithubWriter>(GithubWriter) as FakeGithubWriter;
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
    aiClient = module.get<AiClient>(AiClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function createTriageJob(
    issueNumber: number,
    overrides: Partial<Job> = {},
  ): Promise<Job> {
    const job = await jobService.createJob({
      deliveryId: `dlv-triage-${issueNumber}-${Date.now()}`,
      workflowType: 'issue.opened',
      issueNumber,
      repositoryId: 12345,
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      senderLogin: 'reporter',
    });
    return { ...job, ...overrides };
  }

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute triage for a bug issue and apply labels', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 1,
      title: 'Bug: login form broken',
      body: 'The login form does not submit when clicking the submit button.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    const job = await createTriageJob(1);
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(result.labelsApplied).toContain('bug');
    expect(result.commentWritten).toBe(true);

    // Verify label was written
    const labels = writer.getLabels('owner', 'repo', 1);
    expect(labels).toContain('bug');

    // Verify job status updated
    const updatedJob = await jobService.getJobByDeliveryId(job.deliveryId);
    expect(updatedJob?.status).toBe('completed');
  });

  it('should execute triage for a feature request', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 2,
      title: 'Feature: dark mode support',
      body: 'Please add dark mode to the application for better readability.',
      author: 'user',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    const job = await createTriageJob(2);
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(result.labelsApplied).toContain('enhancement');
    expect(result.commentWritten).toBe(true);
  });

  it('should write idempotent comment with marker', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 3,
      title: 'Bug: crash on startup',
      body: 'Application crashes immediately after launching.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    const job = await createTriageJob(3);
    await service.execute(job);

    const writes = writer.getWrites();
    const commentWrite = writes.find((w) => w.type === 'upsertComment');
    expect(commentWrite).toBeDefined();
    expect(commentWrite!.body).toContain('<!-- ruan-ai:workflow=triage');
    expect(commentWrite!.body).toContain('issue=3');
  });

  it('should attempt repair retry when AI output validation fails and succeed if repair succeeds', async () => {
    const invalidOutput: TriageOutput = {
      workflow: 'triage',
      summary: '', // will fail runtime validation
      riskLevel: 'low',
      suggestedLabels: [],
      missingInformation: [],
      recommendedNextCommand: '/plan',
      commentBody: '', // will fail runtime validation
      confidence: 'low',
      assumptions: [],
      evidence: [],
    };

    jest.spyOn(aiClient, 'triage').mockResolvedValue(invalidOutput);
    const aiFake = aiClient as unknown as FakeTriageAiClient;
    aiFake.setRepairBehavior(() => {
      return {
        workflow: 'triage',
        summary: 'Repaired summary',
        riskLevel: 'low',
        suggestedLabels: [],
        missingInformation: [],
        recommendedNextCommand: '/plan',
        commentBody: 'Repaired triage comment',
        confidence: 'high',
        assumptions: [],
        evidence: [],
      };
    });

    const job = await createTriageJob(99);
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(result.commentWritten).toBe(true);
    const updatedJob = await jobService.getJobByDeliveryId(job.deliveryId);
    expect(updatedJob?.status).toBe('completed');
  });

  it('should fail if repair retry also returns invalid schema output', async () => {
    const invalidOutput: TriageOutput = {
      workflow: 'triage',
      summary: '',
      riskLevel: 'low',
      suggestedLabels: [],
      missingInformation: [],
      recommendedNextCommand: '/plan',
      commentBody: '',
      confidence: 'low',
      assumptions: [],
      evidence: [],
    };

    jest.spyOn(aiClient, 'triage').mockResolvedValue(invalidOutput);
    const aiFake = aiClient as unknown as FakeTriageAiClient;
    aiFake.setRepairBehavior(() => {
      return { invalid: 'still bad' };
    });

    const job = await createTriageJob(100);
    const result = await service.execute(job);

    expect(result.success).toBe(false);
    expect(result.error).toContain('AI triage repair retry failed');
    const updatedJob = await jobService.getJobByDeliveryId(job.deliveryId);
    expect(updatedJob?.status).toBe('failed');
  });

  it('should record github_write_failure and fail if applyLabels throws', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 101,
      title: 'Bug: crash',
      body: 'crash on open',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });
    githubClient.setLabels('owner', 'repo', [
      { name: 'bug', description: 'Bug', color: 'ff0000' },
    ]);

    jest
      .spyOn(writer, 'applyLabels')
      .mockRejectedValue(new Error('GitHub API Error: 500'));
    const recordSpy = jest.spyOn(jobService, 'recordFailureEvent');

    const job = await createTriageJob(101);
    const result = await service.execute(job);

    expect(result.success).toBe(false);
    expect(result.error).toContain('GitHub API Error');
    expect(recordSpy).toHaveBeenCalledWith(
      job.jobId,
      'github_write_failure',
      expect.stringContaining('GitHub API Error: 500'),
    );
  });

  it('should handle partial policy rejection — apply allowed labels, reject others', async () => {
    // Set up labels where only some exist
    githubClient.setLabels('owner', 'repo', [
      { name: 'bug', description: 'Bug', color: 'ff0000' },
      // 'admin' and 'security' do NOT exist
    ]);

    // Override AI to suggest labels that include non-existent ones
    const module = await Test.createTestingModule({
      providers: [
        TriageWorkflowService,
        JobService,
        { provide: JobRepository, useClass: InMemoryJobRepository },
        IssueTriageContextBuilder,
        { provide: GithubClient, useClass: FakeGithubClient },
        {
          provide: AiClient,
          useValue: {
            triage: () =>
              Promise.resolve({
                workflow: 'triage',
                summary: 'Bug requiring investigation.',
                riskLevel: 'medium',
                suggestedLabels: ['bug', 'admin', 'security'],
                missingInformation: [],
                recommendedNextCommand: '/plan',
                commentBody:
                  '## Triage Summary\n\nThis is a bug report that needs investigation.',
                confidence: 'high',
                assumptions: [],
                evidence: [{ source: 'issue_title', content: 'Bug test' }],
              } as TriageOutput),
          },
        },
        TriagePolicyService,
        { provide: GithubWriter, useClass: FakeGithubWriter },
      ],
    }).compile();

    const svc = module.get<TriageWorkflowService>(TriageWorkflowService);
    const js = module.get<JobService>(JobService);
    const w = module.get<GithubWriter>(GithubWriter) as FakeGithubWriter;
    const gc = module.get<GithubClient>(GithubClient) as FakeGithubClient;

    gc.setLabels('owner', 'repo', [
      { name: 'bug', description: 'Bug', color: 'ff0000' },
    ]);

    gc.setIssue('owner', 'repo', {
      number: 10,
      title: 'Bug test',
      body: 'A bug to test partial rejection.',
      author: 'user',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    const job = await js.createJob({
      deliveryId: 'dlv-partial-test',
      workflowType: 'issue.opened',
      issueNumber: 10,
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      senderLogin: 'user',
    });

    const result = await svc.execute(job);

    expect(result.success).toBe(true);
    expect(result.labelsApplied).toEqual(['bug']);
    expect(result.labelsRejected).toHaveLength(2);
    expect(result.labelsRejected.some((r) => r.label === 'admin')).toBe(true);
    expect(result.labelsRejected.some((r) => r.label === 'security')).toBe(
      true,
    );
    // Comment should mention rejected labels
    expect(result.commentWritten).toBe(true);
    const writes = w.getWrites();
    const commentWrite = writes.find((wr) => wr.type === 'upsertComment');
    expect(commentWrite?.body).toContain('rejected by policy');
  });
});
