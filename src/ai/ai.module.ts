import { Module } from '@nestjs/common';
import { AiClient } from './interfaces/ai-client.interface';
import { FakeTriageAiClient } from './fake/fake-triage-ai-client';
import { ModelAvailabilityService } from './services/model-availability.service';

@Module({
  providers: [
    {
      provide: AiClient,
      useClass: FakeTriageAiClient,
    },
    ModelAvailabilityService,
  ],
  exports: [AiClient, ModelAvailabilityService],
})
export class AiModule {}
