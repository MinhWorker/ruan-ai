import { Global, Module } from '@nestjs/common';
import { TelemetryRepository } from './repositories/telemetry.repository';
import { TelemetryService } from './services/telemetry.service';
import { RateLimitTrackerService } from './services/rate-limit-tracker.service';

@Global()
@Module({
  providers: [TelemetryRepository, TelemetryService, RateLimitTrackerService],
  exports: [TelemetryService, RateLimitTrackerService],
})
export class TelemetryModule {}
