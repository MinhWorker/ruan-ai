import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueBlockerContext } from '../interfaces/issue-blocker-context.interface';

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

    const recentComments = comments.slice(-10); // Last 10 comments

    const activePlanComment = comments
      .slice()
      .reverse()
      .find(
        (c) =>
          c.body.includes('<!-- ruan-ai:workflow=plan') &&
          c.body.includes('logical=active-plan'),
      )?.body;

    const activeSplitComment = comments
      .slice()
      .reverse()
      .find(
        (c) =>
          c.body.includes('<!-- ruan-ai:workflow=split') &&
          c.body.includes('logical=task-split'),
      )?.body;

    const activeStatusComment = comments
      .slice()
      .reverse()
      .find(
        (c) =>
          c.body.includes('<!-- ruan-ai:workflow=status') &&
          c.body.includes('logical=current-status'),
      )?.body;

    return {
      issue,
      recentComments,
      activePlanComment,
      activeSplitComment,
      activeStatusComment,
      blockerTriggeringText: params.triggeringCommentBody,
    };
  }
}
