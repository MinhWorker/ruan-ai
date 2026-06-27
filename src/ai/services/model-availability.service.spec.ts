import { Test, TestingModule } from '@nestjs/testing';
import { ModelAvailabilityService } from './model-availability.service';
import { AiClient } from '../interfaces/ai-client.interface';
import { ConfigService } from '../../config/config.service';

describe('ModelAvailabilityService', () => {
  let service: ModelAvailabilityService;

  const mockAiClient = {
    checkModel: jest.fn(),
  };

  const mockConfigService = {
    primaryModelId: 'primary-model',
    fallbackModelId: 'fallback-model',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelAvailabilityService,
        { provide: AiClient, useValue: mockAiClient },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ModelAvailabilityService>(ModelAvailabilityService);
    aiClient = module.get<AiClient>(AiClient);
  });

  it('should be available if primary model is available', async () => {
    mockAiClient.checkModel.mockResolvedValueOnce(true);

    const status = await service.validate();
    expect(status.available).toBe(true);
    expect(status.status).toBe('available');
    expect(status.modelId).toBe('primary-model');
    expect(mockAiClient.checkModel).toHaveBeenCalledWith('primary-model');
  });

  it('should be degraded if primary is unavailable but fallback is available', async () => {
    mockAiClient.checkModel
      .mockResolvedValueOnce(false) // primary
      .mockResolvedValueOnce(true); // fallback

    const status = await service.validate();
    expect(status.available).toBe(true);
    expect(status.status).toBe('degraded');
    expect(status.modelId).toBe('fallback-model');
  });

  it('should be unavailable if both models are unavailable', async () => {
    mockAiClient.checkModel
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false);

    const status = await service.validate();
    expect(status.available).toBe(false);
    expect(status.status).toBe('unavailable');
    expect(status.modelId).toBe('fallback-model');
  });

  it('should return unavailable status when setUnavailableState is called', async () => {
    service.setUnavailableState(true, 'Overloaded');
    const status = await service.validate();
    expect(status.available).toBe(false);
    expect(status.status).toBe('unavailable');
    expect(status.reason).toBe('Overloaded');
    expect(status.fallbackModelId).toBe('fallback-model');
  });
});
