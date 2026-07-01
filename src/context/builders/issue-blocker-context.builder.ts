import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueBlockerContext } from '../interfaces/issue-blocker-context.interface';
import { buildIssueCommentContext } from '../comment-context';

@Injectable()
export class IssueBlockerContextBuilder {
  constructor(private readonly githubClient: GithubClient) {}

  async build(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    senderLogin: string;
    triggeringCommentBody: string;
  }): Promise<IssueBlockerContext> {
    const issue = await this.githubClient.getIssue(
      params.owner,
      params.repo,
      params.issueNumber,
    );
    const comments = await this.githubClient.getIssueComments(
      params.owner,
      params.repo,
      params.issueNumber,
    );

    const commentContext = buildIssueCommentContext(comments);

    const activePlanComment = commentContext.appComments
      .slice()
      .reverse()
      .find(
        (c) => c.workflowMarker === 'plan' && c.logicalMarker === 'active-plan',
      )?.body;

    const activeSplitComment = commentContext.appComments
      .slice()
      .reverse()
      .find(
        (c) => c.workflowMarker === 'split' && c.logicalMarker === 'task-split',
      )?.body;

    const activeStatusComment = commentContext.appComments
      .slice()
      .reverse()
      .find(
        (c) =>
          c.workflowMarker === 'status' && c.logicalMarker === 'current-status',
      )?.body;

    return {
      issue,
      recentComments: commentContext.recentComments,
      activePlanComment,
      activeSplitComment,
      activeStatusComment,
      blockerTriggeringText: params.triggeringCommentBody,
    };
  }
}
