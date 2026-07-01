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
    expect(context.recentComments).toHaveLength(0);
    expect(context.priorTriageComment).toContain('ruan-ai:workflow=triage');
    expect(context.priorPlanComment).toContain('ruan-ai:workflow=plan');
  });

  it('should bound recent comments and keep app workflow comments out of human context', async () => {
    githubClient.setComments('test-org', 'test-repo', 1, [
      ...Array.from({ length: 12 }, (_, index) => ({
        id: index + 1,
        body: `human discussion ${index + 1}`,
        author: `user-${index + 1}`,
        createdAt: `2026-01-01T00:${String(index).padStart(2, '0')}:00Z`,
      })),
      {
        id: 101,
        body: '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 --> prior plan',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
      {
        id: 102,
        body: '@ruangm-ai /status',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:01:00Z',
      },
    ]);

    const context = await builder.build({
      owner: 'test-org',
      repo: 'test-repo',
      issueNumber: 1,
      senderLogin: 'user',
    });

    expect(context.recentComments).toHaveLength(10);
    expect(context.recentComments.map((comment) => comment.id)).toEqual([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(context.recentComments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 12, sourceType: 'human_comment' }),
      ]),
    );
    expect(
      context.recentComments.some((comment) =>
        comment.body.includes('ruan-ai:workflow='),
      ),
    ).toBe(false);
    expect(
      context.recentComments.some((comment) =>
        comment.body.includes('/status'),
      ),
    ).toBe(false);
    expect(context.priorPlanComment).toContain('ruan-ai:workflow=plan');
  });
});
