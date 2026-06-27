import { Test, TestingModule } from '@nestjs/testing';
import { RateLimitTrackerService } from './rate-limit-tracker.service';

describe('RateLimitTrackerService', () => {
  let service: RateLimitTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RateLimitTrackerService],
    }).compile();

    service = module.get<RateLimitTrackerService>(RateLimitTrackerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should track AI request counts and token estimates', () => {
    service.setConfiguredProfile('gemini-test');
    service.recordAiRequest(100);
    service.recordAiRequest(50);

    const snapshot = service.getSnapshot();
    expect(snapshot.aiModel.configuredProfile).toBe('gemini-test');
    expect(snapshot.aiModel.requestCount).toBe(2);
    expect(snapshot.aiModel.estimatedTokens).toBe(150);
    expect(snapshot.aiModel.degradedState).toBe(false);
  });

  it('should track degraded state and reset time', () => {
    const resetTime = new Date();
    resetTime.setHours(resetTime.getHours() + 1); // 1 hour in future

    service.recordAiError('Rate limit exceeded', resetTime);

    let snapshot = service.getSnapshot();
    expect(snapshot.aiModel.degradedState).toBe(true);
    expect(snapshot.aiModel.lastError).toBe('Rate limit exceeded');
    expect(snapshot.aiModel.resetAt).toBe(resetTime);

    // If resetTime is in past, degradedState should be false
    const pastResetTime = new Date();
    pastResetTime.setHours(pastResetTime.getHours() - 1);
    service.recordAiError('Error', pastResetTime);
    snapshot = service.getSnapshot();
    expect(snapshot.aiModel.degradedState).toBe(false);
  });
});
