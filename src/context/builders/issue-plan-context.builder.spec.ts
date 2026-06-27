import { Test, TestingModule } from '@nestjs/testing';
import { IssuePlanContextBuilder } from './issue-plan-context.builder';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';

describe('IssuePlanContextBuilder', () => {
  let builder: IssuePlanContextBuilder;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssuePlanContextBuilder,
        {
          provide: GithubClient,
          useClass: FakeGithubClient,
        },
      ],
    }).compile();

    builder = module.get<IssuePlanContextBuilder>(IssuePlanContextBuilder);
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
  });

  it('should build plan context with comments and identify prior comments', async () => {
    githubClient.setComments('test-org', 'test-repo', 1, [
      {
        id: 101,
        body: '<!-- ruan-ai:workflow=triage issue=1 logical=triage-result version=1 --> triage summary',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 102,
        body: '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 --> plan proposed',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
    ]);

    const context = await builder.build({
      owner: 'test-org',
      repo: 'test-repo',
      issueNumber: 1,
      senderLogin: 'user',
    });

    expect(context.eventType).toBe('comment.created');
    expect(context.recentComments).toHaveLength(2);
    expect(context.priorTriageComment).toContain('ruan-ai:workflow=triage');
    expect(context.priorPlanComment).toContain('ruan-ai:workflow=plan');
  });
});
