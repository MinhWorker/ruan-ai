import { Test, TestingModule } from '@nestjs/testing';
import { RealGithubWriter } from './real-github-writer';
import { ConfigService } from '../../config/config.service';
import { TelemetryService } from '../../telemetry/services/telemetry.service';

describe('RealGithubWriter', () => {
  let writer: RealGithubWriter;
  let telemetryService: jest.Mocked<TelemetryService>;
  let loadOctokitSpy: jest.SpyInstance;

  const mockCreateComment = jest.fn().mockResolvedValue({});
  const mockUpdateComment = jest.fn().mockResolvedValue({});
  const mockAddLabels = jest.fn().mockResolvedValue({});
  const mockListComments = jest.fn().mockResolvedValue({ data: [] });

  beforeEach(async () => {
    jest.clearAllMocks();

    telemetryService = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<TelemetryService>;

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
        {
          provide: TelemetryService,
          useValue: telemetryService,
        },
      ],
    }).compile();

    writer = module.get<RealGithubWriter>(RealGithubWriter);

    loadOctokitSpy = jest
      .spyOn(writer as any, 'loadOctokit')
      .mockResolvedValue({
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

  it('should reuse cached installation octokit clients for repeated writes', async () => {
    await writer.applyLabels('owner', 'repo', 1, ['bug']);
    await writer.applyLabels('owner', 'repo', 2, ['enhancement']);

    // One app client and one installation client are created; the second write
    // reuses the installation client and does not force a new auth strategy.
    expect(loadOctokitSpy).toHaveBeenCalledTimes(2);
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

  describe('telemetry recording', () => {
    it('should record info telemetry when applyLabels succeeds', async () => {
      await writer.applyLabels('owner', 'repo', 1, ['bug']);
      expect(mockAddLabels).toHaveBeenCalled();
      expect(telemetryService.recordEvent.mock.calls[0][0]).toMatchObject({
        type: 'github_write',
        severity: 'info',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        issueNumber: 1,
        metadata: {
          action: 'apply_labels',
          labels: ['bug'],
        },
      });
    });

    it('should record error telemetry and re-throw when applyLabels fails', async () => {
      mockAddLabels.mockRejectedValueOnce(
        new Error('Rate limit exceeded on labels'),
      );

      await expect(
        writer.applyLabels('owner', 'repo', 1, ['bug']),
      ).rejects.toThrow('Rate limit exceeded on labels');

      expect(telemetryService.recordEvent.mock.calls[0][0]).toMatchObject({
        type: 'github_write',
        severity: 'error',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        issueNumber: 1,
        metadata: {
          action: 'apply_labels',
          labels: ['bug'],
          error: 'Rate limit exceeded on labels',
        },
      });
    });

    it('should record info telemetry (create) when upsertComment succeeds and comment does not exist', async () => {
      mockListComments.mockResolvedValueOnce({
        data: [{ id: 1, body: 'Different body' }],
      });

      await writer.upsertComment('owner', 'repo', 1, '<!-- marker -->', 'Body');

      expect(mockCreateComment).toHaveBeenCalled();
      expect(telemetryService.recordEvent.mock.calls[0][0]).toMatchObject({
        type: 'github_write',
        severity: 'info',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        issueNumber: 1,
        metadata: {
          action: 'create_comment',
          marker: '<!-- marker -->',
        },
      });
    });

    it('should record info telemetry (update) when upsertComment succeeds and comment already exists', async () => {
      mockListComments.mockResolvedValueOnce({
        data: [{ id: 22, body: '<!-- marker -->' }],
      });

      await writer.upsertComment('owner', 'repo', 1, '<!-- marker -->', 'Body');

      expect(mockUpdateComment).toHaveBeenCalled();
      expect(telemetryService.recordEvent.mock.calls[0][0]).toMatchObject({
        type: 'github_write',
        severity: 'info',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        issueNumber: 1,
        metadata: {
          action: 'update_comment',
          marker: '<!-- marker -->',
        },
      });
    });

    it('should record error telemetry and re-throw when upsertComment fails', async () => {
      mockListComments.mockRejectedValueOnce(
        new Error('Network error listing comments'),
      );

      await expect(
        writer.upsertComment('owner', 'repo', 1, '<!-- marker -->', 'Body'),
      ).rejects.toThrow('Network error listing comments');

      expect(telemetryService.recordEvent.mock.calls[0][0]).toMatchObject({
        type: 'github_write',
        severity: 'error',
        repositoryOwner: 'owner',
        repositoryName: 'repo',
        issueNumber: 1,
        metadata: {
          action: 'upsert_comment',
          marker: '<!-- marker -->',
          error: 'Network error listing comments',
        },
      });
    });
  });
});
