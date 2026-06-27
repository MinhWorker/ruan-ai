import { Test, TestingModule } from '@nestjs/testing';
import { OpsController } from './ops.controller';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../telemetry/services/rate-limit-tracker.service';
import { ModelAvailabilityService } from '../ai/services/model-availability.service';
import { TelemetryRepository } from '../telemetry/repositories/telemetry.repository';

describe('OpsController', () => {
  let controller: OpsController;
  let rateLimitTracker: RateLimitTrackerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OpsController],
      providers: [
        TelemetryService,
        TelemetryRepository,
        RateLimitTrackerService,
        ModelAvailabilityService,
      ],
    }).compile();

    controller = module.get<OpsController>(OpsController);
    rateLimitTracker = module.get<RateLimitTrackerService>(
      RateLimitTrackerService,
    );
  });

  it('should return health status', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      telemetryEventCount: 0,
      auditRecordCount: 0,
    });
  });

  it('should return rate limit snapshot', () => {
    rateLimitTracker.recordAiRequest(100);
    const snapshot = controller.getRateLimit();
    expect(snapshot.aiModel.requestCount).toBe(1);
  });

  it('should return model availability', () => {
    const status = controller.getModelAvailability();
    expect(status.available).toBe(true);
  });
});
