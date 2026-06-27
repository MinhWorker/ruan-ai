import { Module } from '@nestjs/common';
import { JobExecutionService } from './job-execution.service';
import { ConfigModule } from '../config/config.module';
import { PmWorkflowModule } from '../pm-workflow/pm-workflow.module';
import { JobModule } from '../job/job.module';

@Module({
  imports: [ConfigModule, PmWorkflowModule, JobModule],
  providers: [JobExecutionService],
  exports: [JobExecutionService],
})
export class ExecutionModule {}
