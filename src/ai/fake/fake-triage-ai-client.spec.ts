import { Test, TestingModule } from '@nestjs/testing';
import { FakeTriageAiClient } from './fake-triage-ai-client';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { IssueStatusContext } from '../../context/interfaces/issue-status-context.interface';

describe('FakeTriageAiClient', () => {
  let client: FakeTriageAiClient;
  let telemetryService: jest.Mocked<TelemetryService>;
  let rateLimitTracker: jest.Mocked<RateLimitTrackerService>;

  beforeEach(async () => {
    telemetryService = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<TelemetryService>;

    rateLimitTracker = {
      recordAiRequest: jest.fn(),
    } as unknown as jest.Mocked<RateLimitTrackerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FakeTriageAiClient,
        { provide: TelemetryService, useValue: telemetryService },
        { provide: RateLimitTrackerService, useValue: rateLimitTracker },
      ],
    }).compile();

    client = module.get<FakeTriageAiClient>(FakeTriageAiClient);
  });

  it('should run triage without credentials and record telemetry', async () => {
    const context = {
      issue: { number: 1, title: 'bug', body: 'This is a test bug report.' },
      repositoryLabels: [{ name: 'bug', color: 'ff0000' }],
    } as IssueTriageContext;

    const result = await client.triage(context);
    expect(result.workflow).toBe('triage');

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jest.mocked(telemetryService.recordEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'model_call',
        metadata: { workflow: 'triage' },
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(jest.mocked(rateLimitTracker.recordAiRequest)).toHaveBeenCalledWith(
      100,
    );
  });

  it('should report blocked status when linked pull request checks fail', async () => {
    const context: IssueStatusContext = {
      issue: {
        number: 1,
        title: 'Implement feature',
        body: 'Feature work',
        author: 'user',
        createdAt: '2026-01-01T00:00:00Z',
        labels: [],
      },
      repositoryLabels: [],
      recentComments: [],
      appComments: [],
      scheduledFollowUps: [],
      linkedPullRequests: [
        {
          number: 42,
          title: 'Implement feature',
          state: 'open',
          author: 'dev',
          url: 'https://github.com/test/repo/pull/42',
          headRefName: 'feature',
          headSha: 'abc123',
          baseRefName: 'develop',
          draft: false,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T01:00:00Z',
        },
      ],
      checkRuns: [
        {
          pullRequestNumber: 42,
          ref: 'abc123',
          name: 'unit-tests',
          status: 'completed',
          conclusion: 'failure',
        },
      ],
      relatedIssues: [],
      unavailableContextSources: [],
    };

    const result = await client.status(context);

    expect(result.state).toBe('blocked');
    expect(result.blockers).toContain('PR #42 has failing check: unit-tests');
    expect(result.nextAction).toBe('Fix failing checks on PR #42');
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'check_run:unit-tests',
          type: 'observed',
        }),
      ]),
    );
  });
});
