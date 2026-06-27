import { Module } from '@nestjs/common';
import { AiClient } from './interfaces/ai-client.interface';
import { FakeTriageAiClient } from './fake/fake-triage-ai-client';

@Module({
  providers: [
    {
      provide: AiClient,
      useClass: FakeTriageAiClient,
    },
  ],
  exports: [AiClient],
})
export class AiModule {}
