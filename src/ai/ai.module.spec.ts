import { Test, TestingModule } from '@nestjs/testing';
import { AiClient } from './interfaces/ai-client.interface';
import { AiModule } from './ai.module';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../telemetry/services/rate-limit-tracker.service';
import { IssueTriageContext } from '../context/interfaces/issue-triage-context.interface';

describe('AiModule', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should wire fake AI telemetry dependencies in fake mode', async () => {
    process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    process.env.PROVIDER_MODE = 'fake';

    const module: TestingModule = await Test.createTestingModule({
      imports: [AiModule],
    }).compile();

    const aiClient = module.get<AiClient>(AiClient);
    const telemetryService = module.get<TelemetryService>(TelemetryService);
    const rateLimitTracker = module.get<RateLimitTrackerService>(
      RateLimitTrackerService,
    );

    const before = rateLimitTracker.getSnapshot().aiModel.requestCount;
    const context: IssueTriageContext = {
      eventType: 'issues.opened',
      repository: {
        id: 1,
        fullName: 'owner/repo',
        defaultBranch: 'main',
      },
      issue: {
        number: 1,
        title: 'bug report',
        body: 'This is a detailed bug report.',
        author: 'octocat',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      sender: {
        login: 'octocat',
      },
      repositoryLabels: [
        {
          name: 'bug',
          description: '',
          color: 'ff0000',
        },
      ],
      currentIssueLabels: [],
      config: {
        labelAllowlist: null,
        maxLabels: 5,
      },
    };

    await aiClient.triage(context);
    const after = rateLimitTracker.getSnapshot().aiModel.requestCount;

    expect(telemetryService).toBeDefined();
    expect(after).toBe(before + 1);
  });
});
