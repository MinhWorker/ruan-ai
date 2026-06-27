import { Test, TestingModule } from '@nestjs/testing';
import { ModelAvailabilityService } from './model-availability.service';

describe('ModelAvailabilityService', () => {
  let service: ModelAvailabilityService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ModelAvailabilityService],
    }).compile();

    service = module.get<ModelAvailabilityService>(ModelAvailabilityService);
  });

  it('should be available by default in fake mode', () => {
    const status = service.validate();
    expect(status.available).toBe(true);
    expect(status.status).toBe('available');
    expect(status.modelId).toBe('fake-model-local');
  });

  it('should return unavailable status when setUnavailableState is called', () => {
    service.setUnavailableState(true, 'Overloaded');
    const status = service.validate();
    expect(status.available).toBe(false);
    expect(status.status).toBe('unavailable');
    expect(status.reason).toBe('Overloaded');
    expect(status.fallbackModelId).toBe('fake-model-local-fallback');
  });

  it('should expose configured fake model ids', () => {
    service.setConfiguredModelId('fake-primary');
    service.setFallbackModelId('fake-fallback');
    service.setUnavailableState(true);

    const status = service.validate();

    expect(status.modelId).toBe('fake-primary');
    expect(status.fallbackModelId).toBe('fake-fallback');
  });
});
