import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JobService } from './../src/job/job.service';
import { PmWorkflowService } from './../src/pm-workflow/services/pm-workflow.service';
import { GithubWriter } from './../src/github-writer/interfaces/github-writer.interface';
import { FakeGithubWriter } from './../src/github-writer/fake/fake-github-writer';
import { GithubClient } from './../src/github-client/interfaces/github-client.interface';
import { FakeGithubClient } from './../src/github-client/fake/fake-github-client';
import { SignatureGuard } from './../src/webhook/guards/signature.guard';

describe('Planning And Splitting E2E', () => {
  let app: INestApplication<App>;
  let jobService: JobService;
  let pmWorkflowService: PmWorkflowService;
  let writer: FakeGithubWriter;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'e2e-test-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(SignatureGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    await app.init();

    jobService = moduleFixture.get<JobService>(JobService);
    pmWorkflowService = moduleFixture.get<PmWorkflowService>(PmWorkflowService);
    writer = moduleFixture.get<GithubWriter>(GithubWriter) as FakeGithubWriter;
    githubClient = moduleFixture.get<GithubClient>(
      GithubClient,
    ) as FakeGithubClient;
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /github/webhooks with /plan comment should create job and execute planning', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 10,
      title: 'Plan milestone features',
      body: 'Write context, schemas and routing.',
      author: 'reporter',
      createdAt: '2026-06-27T00:00:00Z',
      labels: [],
    });

    const response = await request(app.getHttpServer())
      .post('/github/webhooks')
      .set('x-github-event', 'issue_comment')
      .set('x-github-delivery', 'e2e-delivery-plan')
      .send({
        action: 'created',
        issue: { number: 10 },
        comment: { id: 201, body: 'Please @ruangm-ai /plan the work.' },
        repository: {
          id: 12345,
          name: 'repo',
          full_name: 'owner/repo',
          owner: { login: 'owner' },
        },
        sender: { login: 'reporter', id: 999 },
      })
      .expect(202);

    const body = response.body as { status: string; jobId: string };
    expect(body.status).toBe('accepted');

    const job = await jobService.getJobByDeliveryId('e2e-delivery-plan');
    expect(job?.workflowType).toBe('comment.plan');

    const result = await pmWorkflowService.processJob(job!);
    expect(result?.success).toBe(true);
    expect(result?.commentWritten).toBe(true);

    const comment = writer.getComment(
      'owner',
      'repo',
      10,
      '<!-- ruan-ai:workflow=plan issue=10 logical=active-plan version=1 -->',
    );
    expect(comment).toBeDefined();
    expect(comment).toContain('## Proposed Plan');
  });

  it('POST /github/webhooks with /split comment should validate active plan presence and task safety', async () => {
    githubClient.setIssue('owner', 'repo', {
      number: 11,
      title: 'Split milestone features',
      body: 'Do split.',
      author: 'reporter',
      createdAt: '2026-06-27T00:00:00Z',
      labels: [],
    });

    // Subtest A: No active plan exists
    await request(app.getHttpServer())
      .post('/github/webhooks')
      .set('x-github-event', 'issue_comment')
      .set('x-github-delivery', 'e2e-delivery-split-noplan')
      .send({
        action: 'created',
        issue: { number: 11 },
        comment: { id: 202, body: 'Can we run @ruangm-ai /split?' },
        repository: {
          id: 12345,
          name: 'repo',
          full_name: 'owner/repo',
          owner: { login: 'owner' },
        },
        sender: { login: 'reporter', id: 999 },
      })
      .expect(202);

    const jobNoPlan = await jobService.getJobByDeliveryId(
      'e2e-delivery-split-noplan',
    );
    const resultNoPlan = await pmWorkflowService.processJob(jobNoPlan!);
    expect(resultNoPlan?.success).toBe(false);
    expect(resultNoPlan?.error).toContain('without an active plan');

    // Subtest B: Active plan exists
    githubClient.setComments('owner', 'repo', 11, [
      {
        id: 501,
        body: '<!-- ruan-ai:workflow=plan issue=11 logical=active-plan version=1 --> Proposed plan.',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
    ]);

    // Subtest B: Active plan exists
    await request(app.getHttpServer())
      .post('/github/webhooks')
      .set('x-github-event', 'issue_comment')
      .set('x-github-delivery', 'e2e-delivery-split-withplan')
      .send({
        action: 'created',
        issue: { number: 11 },
        comment: { id: 203, body: 'Can we run @ruangm-ai /split?' },
        repository: {
          id: 12345,
          name: 'repo',
          full_name: 'owner/repo',
          owner: { login: 'owner' },
        },
        sender: { login: 'reporter', id: 999 },
      })
      .expect(202);

    const jobWithPlan = await jobService.getJobByDeliveryId(
      'e2e-delivery-split-withplan',
    );
    const resultWithPlan = await pmWorkflowService.processJob(jobWithPlan!);
    expect(resultWithPlan?.success).toBe(true);
    expect(resultWithPlan?.commentWritten).toBe(true);

    const comment = writer.getComment(
      'owner',
      'repo',
      11,
      '<!-- ruan-ai:workflow=split issue=11 logical=task-split version=1 -->',
    );
    expect(comment).toBeDefined();
    expect(comment).toContain('## Proposed Coding-Agent Task Split');
  });
});
