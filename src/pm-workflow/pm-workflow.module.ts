import { Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { ContextModule } from '../context/context.module';
import { AiModule } from '../ai/ai.module';
import { PolicyModule } from '../policy/policy.module';
import { GithubWriterModule } from '../github-writer/github-writer.module';
import { TriageWorkflowService } from './services/triage-workflow.service';
import { PlanWorkflowService } from './services/plan-workflow.service';
import { SplitWorkflowService } from './services/split-workflow.service';
import { PmWorkflowService } from './services/pm-workflow.service';

@Module({
  imports: [
    JobModule,
    ContextModule,
    AiModule,
    PolicyModule,
    GithubWriterModule,
  ],
  providers: [
    TriageWorkflowService,
    PlanWorkflowService,
    SplitWorkflowService,
    PmWorkflowService,
  ],
  exports: [PmWorkflowService],
})
export class PmWorkflowModule {}
