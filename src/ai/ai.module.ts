import { Module } from '@nestjs/common';
import { AiClient } from './interfaces/ai-client.interface';
import { FakeTriageAiClient } from './fake/fake-triage-ai-client';
import { RealAiClient } from './real/real-ai-client';
import { ModelAvailabilityService } from './services/model-availability.service';
import { ConfigModule } from '../config/config.module';
import { ConfigService } from '../config/config.service';
import { TelemetryModule } from '../telemetry/telemetry.module';
import { TelemetryService } from '../telemetry/services/telemetry.service';
import { RateLimitTrackerService } from '../telemetry/services/rate-limit-tracker.service';

@Module({
  imports: [ConfigModule, TelemetryModule],
  providers: [
    {
      provide: AiClient,
      inject: [ConfigService, TelemetryService, RateLimitTrackerService],
      useFactory: (
        config: ConfigService,
        telemetryService: TelemetryService,
        rateLimitTracker: RateLimitTrackerService,
      ) => {
        if (config.providerMode === 'real') {
          return new RealAiClient(config, telemetryService, rateLimitTracker);
        }
        return new FakeTriageAiClient(telemetryService, rateLimitTracker);
      },
    },
    ModelAvailabilityService,
  ],
  exports: [AiClient, ModelAvailabilityService],
})
export class AiModule {}
