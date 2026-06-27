import { Module } from '@nestjs/common';
import { GithubClientModule } from '../github-client/github-client.module';
import { IssueTriageContextBuilder } from './builders/issue-triage-context.builder';
import { IssuePlanContextBuilder } from './builders/issue-plan-context.builder';
import { IssueSplitContextBuilder } from './builders/issue-split-context.builder';
import { IssueStatusContextBuilder } from './builders/issue-status-context.builder';
import { IssueBlockerContextBuilder } from './builders/issue-blocker-context.builder';
import { JobModule } from '../job/job.module';

@Module({
  imports: [GithubClientModule, JobModule],
  providers: [
    IssueTriageContextBuilder,
    IssuePlanContextBuilder,
    IssueSplitContextBuilder,
    IssueStatusContextBuilder,
    IssueBlockerContextBuilder,
  ],
  exports: [
    IssueTriageContextBuilder,
    IssuePlanContextBuilder,
    IssueSplitContextBuilder,
    IssueStatusContextBuilder,
    IssueBlockerContextBuilder,
  ],
})
export class ContextModule {}
