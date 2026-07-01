import { Test, TestingModule } from '@nestjs/testing';
import { IssueStatusContextBuilder } from './issue-status-context.builder';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';
import { FollowUpService } from '../../job/follow-up.service';

describe('IssueStatusContextBuilder', () => {
  let builder: IssueStatusContextBuilder;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueStatusContextBuilder,
        {
          provide: GithubClient,
          useClass: FakeGithubClient,
        },
        {
          provide: FollowUpService,
          useValue: { getPendingByIssue: jest.fn().mockResolvedValue([]) },
        },
      ],
    }).compile();

    builder = module.get<IssueStatusContextBuilder>(IssueStatusContextBuilder);
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
  });

  it('should separate generated app comments from bounded recent discussion', async () => {
    githubClient.setComments('test-org', 'test-repo', 1, [
      ...Array.from({ length: 11 }, (_, index) => ({
        id: index + 1,
        body: `human update ${index + 1}`,
        author: `user-${index + 1}`,
        createdAt: `2026-01-01T00:${String(index).padStart(2, '0')}:00Z`,
      })),
      {
        id: 101,
        body: '<!-- ruan-ai:workflow=status issue=1 logical=current-status version=1 --> current status',
        author: 'ruan-ai[bot]',
        createdAt: '2026-01-01T01:00:00Z',
      },
      {
        id: 102,
        body: '@ruangm-ai /plan',
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
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
    ]);
    expect(context.recentComments[0]).toMatchObject({
      id: 2,
      sourceType: 'human_comment',
    });
    expect(
      context.recentComments.some((comment) =>
        comment.body.includes('ruan-ai:workflow='),
      ),
    ).toBe(false);
    expect(
      context.recentComments.some((comment) => comment.body.includes('/plan')),
    ).toBe(false);
    expect(context.appComments).toEqual([
      expect.objectContaining({
        id: 101,
        sourceType: 'app_generated',
        workflowMarker: 'status',
      }),
    ]);
  });

  it('should include linked pull requests, check runs, and related issues when available', async () => {
    githubClient.setLinkedPullRequests('test-org', 'test-repo', 1, [
      {
        number: 42,
        title: 'Implement status context',
        state: 'open',
        author: 'contributor',
        url: 'https://github.com/test-org/test-repo/pull/42',
        headRefName: 'codex/status-context',
        headSha: 'abc123',
        baseRefName: 'develop',
        draft: false,
        mergeableState: 'clean',
        changedFiles: 3,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T01:00:00Z',
      },
    ]);
    githubClient.setCheckRuns('test-org', 'test-repo', 'abc123', [
      {
        name: 'unit-tests',
        status: 'completed',
        conclusion: 'success',
        detailsUrl: 'https://github.com/test-org/test-repo/actions/runs/1',
      },
    ]);
    githubClient.setRelatedIssues('test-org', 'test-repo', 1, [
      {
        number: 7,
        title: 'Related blocker',
        state: 'open',
        relationship: 'mentioned',
        url: 'https://github.com/test-org/test-repo/issues/7',
      },
    ]);

    const context = await builder.build({
      owner: 'test-org',
      repo: 'test-repo',
      issueNumber: 1,
      senderLogin: 'user',
    });

    expect(context.linkedPullRequests).toEqual([
      expect.objectContaining({
        number: 42,
        mergeableState: 'clean',
        changedFiles: 3,
      }),
    ]);
    expect(context.checkRuns).toEqual([
      expect.objectContaining({
        pullRequestNumber: 42,
        ref: 'abc123',
        name: 'unit-tests',
        conclusion: 'success',
      }),
    ]);
    expect(context.relatedIssues).toEqual([
      expect.objectContaining({
        number: 7,
        relationship: 'mentioned',
      }),
    ]);
    expect(context.unavailableContextSources).toEqual([]);
  });

  it('should record unavailable optional context sources without failing status context', async () => {
    githubClient.failLinkedPullRequestsOnce(new Error('Missing permission'));

    const context = await builder.build({
      owner: 'test-org',
      repo: 'test-repo',
      issueNumber: 1,
      senderLogin: 'user',
    });

    expect(context.linkedPullRequests).toEqual([]);
    expect(context.checkRuns).toEqual([]);
    expect(context.relatedIssues).toEqual([]);
    expect(context.unavailableContextSources).toEqual([
      expect.objectContaining({
        source: 'linked_pull_requests',
        reason: 'Missing permission',
      }),
    ]);
  });
});
