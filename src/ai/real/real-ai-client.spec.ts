import { Test, TestingModule } from '@nestjs/testing';
import { RealAiClient } from './real-ai-client';
import { ConfigService } from '../../config/config.service';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';

const mockGenerateContent = jest.fn();
const mockGetModel = jest.fn();

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
      get: mockGetModel,
    },
  })),
}));

describe('RealAiClient', () => {
  let client: RealAiClient;
  let telemetryService: jest.Mocked<TelemetryService>;
  let rateLimitTracker: jest.Mocked<RateLimitTrackerService>;
  const triageContext = {} as IssueTriageContext;

  beforeEach(async () => {
    jest.clearAllMocks();

    telemetryService = {
      recordEvent: jest.fn(),
    } as unknown as jest.Mocked<TelemetryService>;
    rateLimitTracker = {
      recordAiRequest: jest.fn(),
      recordAiError: jest.fn(),
    } as unknown as jest.Mocked<RateLimitTrackerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealAiClient,
        {
          provide: ConfigService,
          useValue: {
            googleAiStudioApiKey: 'test-key',
            primaryModelId: 'primary-model',
            fallbackModelId: 'fallback-model',
          },
        },
        {
          provide: TelemetryService,
          useValue: telemetryService,
        },
        {
          provide: RateLimitTrackerService,
          useValue: rateLimitTracker,
        },
      ],
    }).compile();

    client = module.get<RealAiClient>(RealAiClient);
  });

  it('should successfully parse JSON response on triage', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"summary":"Test","commentBody":"Test body"}',
    });

    const result = await client.triage(triageContext);
    expect(result).toEqual({ summary: 'Test', commentBody: 'Test body' });
    expect(mockGenerateContent).toHaveBeenCalled();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(telemetryService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'model_call',
        metadata: { workflow: 'triage', modelId: 'fallback-model' },
      }),
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(rateLimitTracker.recordAiRequest).toHaveBeenCalled();
  });

  it('should pass an abort signal and system instructions to Google GenAI calls', async () => {
    mockGenerateContent.mockResolvedValueOnce({
      text: '{"summary":"Test","commentBody":"Test body"}',
    });

    await client.triage(triageContext);

    const [call] = mockGenerateContent.mock.calls as Array<
      [{ config?: { abortSignal?: unknown; systemInstruction?: string } }]
    >;
    expect(call[0].config?.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call[0].config?.systemInstruction).toContain('untrusted data');
    expect(call[0].config?.systemInstruction).toContain('slash commands');
    expect(call[0].config?.systemInstruction).toContain('proposals');
    expect(call[0].config?.systemInstruction).toContain('strict JSON');
    expect(call[0].config?.systemInstruction).toContain('human questions');
  });

  it('should throw Error if JSON parse fails', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: 'invalid json' });

    await expect(client.triage(triageContext)).rejects.toThrow();
  });

  it('should timeout and throw Error (simulated)', async () => {
    mockGenerateContent.mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AbortError')), 100);
      });
    });

    await expect(client.triage(triageContext)).rejects.toThrow('AbortError');
  });

  it('should successfully run repair and parse JSON', async () => {
    mockGenerateContent.mockResolvedValueOnce({ text: '{"fixed":true}' });

    const result = await client.repair(['error'], 'summary');
    expect(result).toEqual({ fixed: true });
  });

  it('should return true if model check succeeds', async () => {
    mockGetModel.mockResolvedValueOnce({});
    const result = await client.checkModel('primary-model');
    expect(result).toBe(true);
  });

  it('should return false if model check fails', async () => {
    mockGetModel.mockRejectedValueOnce(new Error('Not found'));
    const result = await client.checkModel('invalid-model');
    expect(result).toBe(false);
  });
});
