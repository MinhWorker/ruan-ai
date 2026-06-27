import { Test, TestingModule } from '@nestjs/testing';
import { FakeTriageAiClient } from './fake-triage-ai-client';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';

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
});
