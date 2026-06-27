import { Test, TestingModule } from '@nestjs/testing';
import { SplitWorkflowService } from './split-workflow.service';
import { JobService } from '../../job/job.service';
import { JobRepository } from '../../job/job.repository';
import { InMemoryJobRepository } from '../../job/in-memory-job.repository';
import { IssueSplitContextBuilder } from '../../context/builders/issue-split-context.builder';
import { AiClient } from '../../ai/interfaces/ai-client.interface';
import { FakeTriageAiClient } from '../../ai/fake/fake-triage-ai-client';
import { TriagePolicyService } from '../../policy/services/triage-policy.service';
import { GithubWriter } from '../../github-writer/interfaces/github-writer.interface';
import { FakeGithubWriter } from '../../github-writer/fake/fake-github-writer';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';
import { Job } from '../../job/interfaces/job.interface';

describe('SplitWorkflowService', () => {
  let service: SplitWorkflowService;
  let jobService: JobService;
  let writer: FakeGithubWriter;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SplitWorkflowService,
        JobService,
        {
          provide: JobRepository,
          useClass: InMemoryJobRepository,
        },
        IssueSplitContextBuilder,
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

    service = module.get<SplitWorkflowService>(SplitWorkflowService);
    jobService = module.get<JobService>(JobService);
    writer = module.get<GithubWriter>(GithubWriter) as FakeGithubWriter;
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
  });

  async function createSplitJob(issueNumber: number): Promise<Job> {
    return jobService.createJob({
      deliveryId: `dlv-split-${issueNumber}-${Date.now()}`,
      workflowType: 'comment.split',
      issueNumber,
      repositoryId: 12345,
      repositoryOwner: 'owner',
      repositoryName: 'repo',
      senderLogin: 'reporter',
    });
  }

  it('should successfully execute split and upsert comment if active plan comment exists', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 1,
      title: 'Split tasks',
      body: 'Split them.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    githubClient.setComments('owner', 'repo', 1, [
      {
        id: 102,
        body: '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 --> Proposed plan body.',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
    ]);

    const job = await createSplitJob(1);
    const result = await service.execute(job);

    expect(result.success).toBe(true);
    expect(result.commentWritten).toBe(true);

    const comment = writer.getComment(
      'owner',
      'repo',
      1,
      '<!-- ruan-ai:workflow=split issue=1 logical=task-split version=1 -->',
    );
    expect(comment).toBeDefined();
    expect(comment).toContain('## Proposed Coding-Agent Task Split');
  });

  it('should reject split if no active plan comment exists on the issue', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 2,
      title: 'Split tasks',
      body: 'Split them.',
      author: 'reporter',
      createdAt: '2026-01-01T00:00:00Z',
      labels: [],
    });

    // No comments set -> no active plan

    const job = await createSplitJob(2);
    const result = await service.execute(job);

    expect(result.success).toBe(false);
    expect(result.commentWritten).toBe(false);
    expect(result.error).toContain('without an active plan');
  });
});
