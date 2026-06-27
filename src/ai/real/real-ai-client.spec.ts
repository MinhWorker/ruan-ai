import { Test, TestingModule } from '@nestjs/testing';
import { RealAiClient } from './real-ai-client';
import { ConfigService } from '../../config/config.service';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { TelemetryService } from '../../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../../telemetry/services/rate-limit-tracker.service';
import { getSchemaContract } from '../schemas/schema-contracts';

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
            aiModelTimeoutMs: 120000,
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

    const result = await client.repair(['error'], 'summary', 'status');
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

  // -- New tests for issue #7 acceptance criteria --

  describe('workflow-specific schema contracts in prompts', () => {
    const workflows = ['triage', 'plan', 'split', 'status', 'blocker'] as const;

    for (const workflow of workflows) {
      it(`should include the ${workflow} schema contract in the ${workflow} prompt`, async () => {
        const schemaContract = getSchemaContract(workflow);
        mockGenerateContent.mockResolvedValueOnce({
          text: '{"workflow":"' + workflow + '"}',
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const dummyContext = {} as any;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await (client as any)[workflow](dummyContext);

        const [call] = mockGenerateContent.mock.calls as Array<
          [{ contents?: string }]
        >;
        const promptText = call[0].contents as string;

        // Verify the schema contract is embedded in the prompt
        expect(promptText).toContain(schemaContract);
        // Verify the workflow discriminator is present
        expect(promptText).toContain(`"workflow": "${workflow}"`);
      });
    }
  });

  describe('repair prompt includes target workflow and required fields', () => {
    it('should include the target workflow name in the repair prompt', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '{"workflow":"status","state":"in_progress"}',
      });

      await client.repair(
        ['state must be one of not_started, ready, ...'],
        'Status workflow for repo owner/repo issue #1',
        'status',
      );

      const [call] = mockGenerateContent.mock.calls as Array<
        [{ contents?: string }]
      >;
      const promptText = call[0].contents as string;

      expect(promptText).toContain('"status"');
      expect(promptText).toContain('## Target Workflow');
      expect(promptText).toContain('status');
      expect(promptText).toContain('---BEGIN UNTRUSTED CONTEXT SUMMARY---');
      expect(promptText).toContain(getSchemaContract('status'));
    });

    it('should include a different schema contract for a different target workflow', async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: '{"workflow":"triage"}',
      });

      await client.repair(
        ['summary must be a non-empty string'],
        'Triage workflow context',
        'triage',
      );

      const [call] = mockGenerateContent.mock.calls as Array<
        [{ contents?: string }]
      >;
      const promptText = call[0].contents as string;

      expect(promptText).toContain('"triage"');
      expect(promptText).toContain(getSchemaContract('triage'));
      // Ensure it does NOT contain a different workflow's contract discriminator
      expect(promptText).not.toContain('"workflow": "plan"');
    });
  });

  describe('configurable model timeout', () => {
    it('should use custom timeout from ConfigService', async () => {
      const customModule: TestingModule = await Test.createTestingModule({
        providers: [
          RealAiClient,
          {
            provide: ConfigService,
            useValue: {
              googleAiStudioApiKey: 'test-key',
              primaryModelId: 'primary-model',
              fallbackModelId: 'fallback-model',
              aiModelTimeoutMs: 60000,
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

      const customClient = customModule.get<RealAiClient>(RealAiClient);
      // Access private field via any cast to verify configuration
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((customClient as any).timeoutMs).toBe(60000);
    });

    it('should use default 120s timeout when ConfigService provides 120000', () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect((client as any).timeoutMs).toBe(120000);
    });
  });

  describe('telemetry error classification', () => {
    it('should classify abort errors as provider_timeout', async () => {
      const abortError = new Error('This operation was aborted');
      abortError.name = 'AbortError';
      mockGenerateContent.mockRejectedValueOnce(abortError);

      await expect(client.triage(triageContext)).rejects.toThrow();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'model_error',
          severity: 'error',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: expect.objectContaining({
            failureCategory: 'provider_timeout',
            workflow: 'triage',
          }),
        }),
      );
    });

    it('should classify non-abort errors as provider_error', async () => {
      mockGenerateContent.mockRejectedValueOnce(
        new Error('Network connection failed'),
      );

      await expect(client.triage(triageContext)).rejects.toThrow();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'model_error',
          severity: 'error',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: expect.objectContaining({
            failureCategory: 'provider_error',
            workflow: 'triage',
          }),
        }),
      );
    });

    it('should classify repair abort errors as provider_timeout with repair:workflow prefix', async () => {
      const abortError = new Error('This operation was aborted');
      abortError.name = 'AbortError';
      mockGenerateContent.mockRejectedValueOnce(abortError);

      await expect(
        client.repair(['error'], 'summary', 'status'),
      ).rejects.toThrow();

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(telemetryService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'model_error',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: expect.objectContaining({
            failureCategory: 'provider_timeout',
            workflow: 'repair:status',
          }),
        }),
      );
    });
  });
});
