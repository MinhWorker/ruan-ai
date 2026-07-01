import { Test, TestingModule } from '@nestjs/testing';
import { IssueBlockerContextBuilder } from './issue-blocker-context.builder';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';

describe('IssueBlockerContextBuilder', () => {
  let builder: IssueBlockerContextBuilder;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueBlockerContextBuilder,
        {
          provide: GithubClient,
          useClass: FakeGithubClient,
        },
      ],
    }).compile();

    builder = module.get<IssueBlockerContextBuilder>(
      IssueBlockerContextBuilder,
    );
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
  });

  it('should keep workflow markers as active references but not recent discussion', async () => {
    githubClient.setComments('test-org', 'test-repo', 1, [
      ...Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        body: `human blocker evidence ${index + 1}`,
        author: `user-${index + 1}`,
        createdAt: `2026-01-01T00:${String(index).padStart(2, '0')}:00Z`,
      })),
      {
        id: 101,
        body: '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 --> active plan',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
      {
        id: 102,
        body: '<!-- ruan-ai:workflow=split issue=1 logical=task-split version=1 --> active split',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:01:00Z',
      },
      {
        id: 103,
        body: '<!-- ruan-ai:workflow=status issue=1 logical=current-status version=1 --> active status',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:02:00Z',
      },
      {
        id: 104,
        body: '@ruangm-ai /blocker',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:03:00Z',
      },
    ]);

    const context = await builder.build({
      owner: 'test-org',
      repo: 'test-repo',
      issueNumber: 1,
      senderLogin: 'user',
      triggeringCommentBody: '@ruangm-ai /blocker human report',
    });

    expect(context.recentComments).toHaveLength(10);
    expect(context.recentComments.map((comment) => comment.id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(context.recentComments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 10, sourceType: 'human_comment' }),
      ]),
    );
    expect(
      context.recentComments.some((comment) =>
        comment.body.includes('ruan-ai:workflow='),
      ),
    ).toBe(false);
    expect(
      context.recentComments.some((comment) =>
        comment.body.includes('/blocker'),
      ),
    ).toBe(false);
    expect(context.activePlanComment).toContain('ruan-ai:workflow=plan');
    expect(context.activeSplitComment).toContain('ruan-ai:workflow=split');
    expect(context.activeStatusComment).toContain('ruan-ai:workflow=status');
  });
});
