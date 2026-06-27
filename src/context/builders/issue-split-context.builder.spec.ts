import { Test, TestingModule } from '@nestjs/testing';
import { IssueSplitContextBuilder } from './issue-split-context.builder';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { FakeGithubClient } from '../../github-client/fake/fake-github-client';

describe('IssueSplitContextBuilder', () => {
  let builder: IssueSplitContextBuilder;
  let githubClient: FakeGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IssueSplitContextBuilder,
        {
          provide: GithubClient,
          useClass: FakeGithubClient,
        },
      ],
    }).compile();

    builder = module.get<IssueSplitContextBuilder>(IssueSplitContextBuilder);
    githubClient = module.get<GithubClient>(GithubClient) as FakeGithubClient;
  });

  it('should build split context and extract active plan comment', async () => {
    githubClient.setComments('test-org', 'test-repo', 1, [
      {
        id: 102,
        body: '<!-- ruan-ai:workflow=plan issue=1 logical=active-plan version=1 --> active plan description',
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
    expect(context.activePlanComment).toContain('ruan-ai:workflow=plan');
  });
});
