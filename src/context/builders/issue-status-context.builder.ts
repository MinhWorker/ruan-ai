import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueStatusContext } from '../interfaces/issue-status-context.interface';
import { FollowUpService } from '../../job/follow-up.service';

@Injectable()
export class IssueStatusContextBuilder {
  constructor(
    private readonly githubClient: GithubClient,
    private readonly followUpService: FollowUpService,
  ) {}

  async build(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    senderLogin: string;
  }): Promise<IssueStatusContext> {
    const issue = await this.githubClient.getIssue(
      params.owner,
      params.repo,
      params.issueNumber,
    );
    const labels = await this.githubClient.getRepositoryLabels(
      params.owner,
      params.repo,
    );
    const comments = await this.githubClient.getIssueComments(
      params.owner,
      params.repo,
      params.issueNumber,
    );

    const scheduledFollowUps = await this.followUpService.getPendingByIssue(
      params.issueNumber,
      params.owner,
      params.repo,
    );

    const recentComments = comments.slice(-10); // Last 10 comments
    const appComments = comments.filter((c) =>
      c.body.includes('<!-- ruan-ai:workflow='),
    );

    return {
      issue,
      repositoryLabels: labels,
      recentComments,
      appComments,
      scheduledFollowUps,
    };
  }
}
