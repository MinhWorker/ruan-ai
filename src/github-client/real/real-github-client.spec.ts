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
            get: jest.fn().mockResolvedValue({
              data: {
                number: 1,
                title: 'Title',
                body: 'Body',
                user: { login: 'user' },
                created_at: '2023-01-01',
                labels: ['bug'],
              },
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
});
