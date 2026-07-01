import { Injectable, Logger } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueSplitContext } from '../interfaces/issue-split-context.interface';
import { buildIssueCommentContext } from '../comment-context';

const MAX_BODY_LENGTH = 10_000;

@Injectable()
export class IssueSplitContextBuilder {
  private readonly logger = new Logger(IssueSplitContextBuilder.name);

  constructor(private readonly githubClient: GithubClient) {}

  async build(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    senderLogin: string;
  }): Promise<IssueSplitContext> {
    this.logger.log(
      `Building split context for ${params.owner}/${params.repo}#${params.issueNumber}`,
    );

    const [repository, issue, repositoryLabels, comments] = await Promise.all([
      this.githubClient.getRepository(params.owner, params.repo),
      this.githubClient.getIssue(params.owner, params.repo, params.issueNumber),
      this.githubClient.getRepositoryLabels(params.owner, params.repo),
      this.githubClient.getIssueComments(
        params.owner,
        params.repo,
        params.issueNumber,
      ),
    ]);

    const body =
      issue.body.length > MAX_BODY_LENGTH
        ? issue.body.slice(0, MAX_BODY_LENGTH) + '\n[TRUNCATED]'
        : issue.body;

    const commentContext = buildIssueCommentContext(comments);

    // Find the active plan comment from generated app comment history.
    let activePlanComment = '';
    for (const comment of commentContext.appComments) {
      if (comment.workflowMarker === 'plan') {
        activePlanComment = comment.body;
      }
    }

    return {
      eventType: 'comment.created',
      repository: {
        id: repository.id,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
      },
      issue: {
        number: issue.number,
        title: issue.title,
        body,
        author: issue.author,
        createdAt: issue.createdAt,
      },
      sender: {
        login: params.senderLogin,
      },
      repositoryLabels,
      currentIssueLabels: issue.labels,
      recentComments: commentContext.recentComments,
      activePlanComment,
    };
  }
}
