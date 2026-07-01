import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueStatusContext } from '../interfaces/issue-status-context.interface';
import { FollowUpService } from '../../job/follow-up.service';
import { buildIssueCommentContext } from '../comment-context';

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

    const commentContext = buildIssueCommentContext(comments);

    return {
      issue,
      repositoryLabels: labels,
      recentComments: commentContext.recentComments,
      appComments: commentContext.appComments,
      scheduledFollowUps,
    };
  }
}
