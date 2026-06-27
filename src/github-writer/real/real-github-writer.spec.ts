import { Test, TestingModule } from '@nestjs/testing';
import { RealGithubWriter } from './real-github-writer';
import { ConfigService } from '../../config/config.service';

// removed global mocks

describe('RealGithubWriter', () => {
  let writer: RealGithubWriter;

  const mockCreateComment = jest.fn().mockResolvedValue({});
  const mockUpdateComment = jest.fn().mockResolvedValue({});
  const mockAddLabels = jest.fn().mockResolvedValue({});
  const mockListComments = jest.fn().mockResolvedValue({ data: [] });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealGithubWriter,
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

    writer = module.get<RealGithubWriter>(RealGithubWriter);

    jest.spyOn(writer as any, 'loadOctokit').mockResolvedValue({
      Octokit: jest.fn().mockImplementation(() => ({
        rest: {
          apps: {
            getRepoInstallation: jest
              .fn()
              .mockResolvedValue({ data: { id: 123 } }),
          },
          issues: {
            createComment: mockCreateComment,
            updateComment: mockUpdateComment,
            addLabels: mockAddLabels,
            listComments: mockListComments,
          },
        },
      })),
    });

    jest.spyOn(writer as any, 'loadAuthApp').mockResolvedValue({
      createAppAuth: jest.fn(),
    });
  });

  it('should apply labels using octokit', async () => {
    await writer.applyLabels('owner', 'repo', 1, ['bug']);
    expect(mockAddLabels).toHaveBeenCalled();
  });

  it('should not apply labels if empty array', async () => {
    await writer.applyLabels('owner', 'repo', 1, []);
    expect(mockAddLabels).not.toHaveBeenCalled();
  });

  it('should create comment if marker not found', async () => {
    mockListComments.mockResolvedValueOnce({
      data: [{ id: 1, body: 'Different body' }],
    });
    await writer.upsertComment('owner', 'repo', 1, '<!-- marker -->', 'Body');
    expect(mockCreateComment).toHaveBeenCalled();
    expect(mockUpdateComment).not.toHaveBeenCalled();
  });

  it('should update comment if marker found on later page', async () => {
    mockListComments.mockImplementation((params: { page?: number }) => {
      if (params.page === 1) {
        return Promise.resolve({
          data: Array(100).fill({ id: 1, body: 'Old body' }),
        });
      }
      return Promise.resolve({
        data: [{ id: 101, body: '<!-- marker -->\nOld body 101' }],
      });
    });

    await writer.upsertComment(
      'owner',
      'repo',
      1,
      '<!-- marker -->',
      'New body',
    );
    expect(mockUpdateComment).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: 101 }),
    );
    expect(mockCreateComment).not.toHaveBeenCalled();
  });
});
