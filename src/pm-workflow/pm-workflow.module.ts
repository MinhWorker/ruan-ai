import { Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { ContextModule } from '../context/context.module';
import { AiModule } from '../ai/ai.module';
import { PolicyModule } from '../policy/policy.module';
import { GithubWriterModule } from '../github-writer/github-writer.module';
import { GithubClientModule } from '../github-client/github-client.module';
import { TriageWorkflowService } from './services/triage-workflow.service';
import { PlanWorkflowService } from './services/plan-workflow.service';
import { SplitWorkflowService } from './services/split-workflow.service';
import { StatusWorkflowService } from './services/status-workflow.service';
import { BlockerWorkflowService } from './services/blocker-workflow.service';
import { StopWorkflowService } from './services/stop-workflow.service';
import { PmWorkflowService } from './services/pm-workflow.service';

@Module({
  imports: [
    JobModule,
    ContextModule,
    AiModule,
    PolicyModule,
    GithubWriterModule,
    GithubClientModule,
  ],
  providers: [
    TriageWorkflowService,
    PlanWorkflowService,
    SplitWorkflowService,
    StatusWorkflowService,
    BlockerWorkflowService,
    StopWorkflowService,
    PmWorkflowService,
  ],
  exports: [PmWorkflowService],
})
export class PmWorkflowModule {}
