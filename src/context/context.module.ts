import { Module } from '@nestjs/common';
import { GithubClientModule } from '../github-client/github-client.module';
import { IssueTriageContextBuilder } from './builders/issue-triage-context.builder';

@Module({
  imports: [GithubClientModule],
  providers: [IssueTriageContextBuilder],
  exports: [IssueTriageContextBuilder],
})
export class ContextModule {}
