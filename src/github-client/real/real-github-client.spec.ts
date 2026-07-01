import { Test, TestingModule } from '@nestjs/testing';
import { RealGithubClient } from './real-github-client';
import { ConfigService } from '../../config/config.service';

// removed global mocks

describe('RealGithubClient', () => {
  let client: RealGithubClient;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealGithubClient,
        {
          provide: ConfigService,
          useValue: {
            githubAppId: 'app-id',
            githubAppPrivateKey: 'private-key',
            githubInstallationId: undefined,
          },
        },
      ],
    }).compile();

    client = module.get<RealGithubClient>(RealGithubClient);

    jest.spyOn(client as any, 'loadOctokit').mockResolvedValue({
      Octokit: jest.fn().mockImplementation(() => ({
        rest: {
          apps: {
            getRepoInstallation: jest
              .fn()
              .mockResolvedValue({ data: { id: 123 } }),
          },
          issues: {
            listLabelsForRepo: jest
              .fn()
              .mockImplementation((params: { page?: number }) => {
                if (params.page === 1) {
                  return Promise.resolve({
                    data: Array(100).fill({ name: 'bug', color: 'ff0000' }),
                  });
                }
                return Promise.resolve({
                  data: [{ name: 'enhancement', color: '00ff00' }],
                });
              }),
            get: jest
              .fn()
              .mockImplementation((params: { issue_number: number }) => {
                if (params.issue_number === 7) {
                  return Promise.resolve({
                    data: {
                      number: 7,
                      title: 'Related issue',
                      body: 'Related body',
                      user: { login: 'user' },
                      created_at: '2023-01-02',
                      labels: [],
                      state: 'open',
                      html_url: 'https://github.com/owner/repo/issues/7',
                    },
                  });
                }
                return Promise.resolve({
                  data: {
                    number: params.issue_number,
                    title: 'Title',
                    body: 'Body references #7',
                    user: { login: 'user' },
                    created_at: '2023-01-01',
                    labels: ['bug'],
                    state: 'open',
                    html_url: `https://github.com/owner/repo/issues/${params.issue_number}`,
                  },
                });
              }),
            listComments: jest
              .fn()
              .mockImplementation((params: { page?: number }) => {
                if (params.page === 1) {
                  return Promise.resolve({
                    data: Array(100).fill({
                      id: 1,
                      body: 'Comment',
                      user: { login: 'user' },
                      created_at: '2023-01-01',
                    }),
                  });
                }
                return Promise.resolve({
                  data: [
                    {
                      id: 2,
                      body: 'Comment 2',
                      user: { login: 'user' },
                      created_at: '2023-01-01',
                    },
                  ],
                });
              }),
            listEventsForTimeline: jest
              .fn()
              .mockImplementation((params: { page?: number }) => {
                if (params.page === 1) {
                  return Promise.resolve({
                    data: [
                      {
                        event: 'cross-referenced',
                        source: {
                          issue: {
                            number: 42,
                            pull_request: {},
                          },
                        },
                      },
                    ],
                  });
                }
                return Promise.resolve({ data: [] });
              }),
          },
          repos: {
            get: jest.fn().mockResolvedValue({
              data: {
                id: 1,
                full_name: 'owner/repo',
                default_branch: 'main',
              },
            }),
          },
          pulls: {
            get: jest.fn().mockResolvedValue({
              data: {
                number: 42,
                title: 'Linked PR',
                state: 'open',
                user: { login: 'dev' },
                html_url: 'https://github.com/owner/repo/pull/42',
                head: { ref: 'feature/status', sha: 'abc123' },
                base: { ref: 'develop' },
                draft: false,
                mergeable_state: 'clean',
                changed_files: 4,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T01:00:00Z',
                merged_at: null,
              },
            }),
          },
          checks: {
            listForRef: jest.fn().mockResolvedValue({
              data: {
                check_runs: [
                  {
                    name: 'unit-tests',
                    status: 'completed',
                    conclusion: 'success',
                    started_at: '2026-01-01T00:00:00Z',
                    completed_at: '2026-01-01T00:01:00Z',
                    details_url: 'https://github.com/owner/repo/actions/runs/1',
                  },
                ],
              },
            }),
          },
        },
      })),
    });

    jest.spyOn(client as any, 'loadAuthApp').mockResolvedValue({
      createAppAuth: jest.fn(),
    });
  });

  it('should fetch labels using octokit with pagination', async () => {
    const labels = await client.getRepositoryLabels('owner', 'repo');
    expect(labels.length).toBe(101);
    expect(labels[0].name).toBe('bug');
    expect(labels[100].name).toBe('enhancement');
  });

  it('should fetch issue details using octokit', async () => {
    const issue = await client.getIssue('owner', 'repo', 1);
    expect(issue.number).toBe(1);
    expect(issue.title).toBe('Title');
    expect(issue.labels).toContain('bug');
  });

  it('should fetch repository details using octokit', async () => {
    const repo = await client.getRepository('owner', 'repo');
    expect(repo.fullName).toBe('owner/repo');
    expect(repo.defaultBranch).toBe('main');
  });

  it('should fetch comments using octokit with pagination', async () => {
    const comments = await client.getIssueComments('owner', 'repo', 1);
    expect(comments.length).toBe(101);
    expect(comments[0].id).toBe(1);
    expect(comments[100].id).toBe(2);
  });

  it('should fetch linked pull requests from issue timeline events', async () => {
    const pullRequests = await client.getLinkedPullRequests('owner', 'repo', 1);

    expect(pullRequests).toEqual([
      expect.objectContaining({
        number: 42,
        title: 'Linked PR',
        headSha: 'abc123',
        mergeableState: 'clean',
        changedFiles: 4,
      }),
    ]);
  });

  it('should fetch check runs for a git ref', async () => {
    const checkRuns = await client.getCheckRunsForRef(
      'owner',
      'repo',
      'abc123',
    );

    expect(checkRuns).toEqual([
      expect.objectContaining({
        name: 'unit-tests',
        status: 'completed',
        conclusion: 'success',
      }),
    ]);
  });

  it('should fetch related issues mentioned in issue body or comments', async () => {
    const issues = await client.getRelatedIssues('owner', 'repo', 1);

    expect(issues).toEqual([
      expect.objectContaining({
        number: 7,
        title: 'Related issue',
        relationship: 'mentioned',
      }),
    ]);
  });
});
