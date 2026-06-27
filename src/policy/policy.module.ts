import { Module } from '@nestjs/common';
import { TriagePolicyService } from './services/triage-policy.service';

@Module({
  providers: [TriagePolicyService],
  exports: [TriagePolicyService],
})
export class PolicyModule {}
