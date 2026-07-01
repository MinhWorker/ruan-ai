import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import {
  IssueStatusContext,
  StatusCheckRunContext,
  UnavailableContextSource,
} from '../interfaces/issue-status-context.interface';
import { FollowUpService } from '../../job/follow-up.service';
import { buildIssueCommentContext } from '../comment-context';

const MAX_LINKED_PULL_REQUESTS = 5;
const MAX_CHECK_RUNS_PER_PULL_REQUEST = 10;
const MAX_RELATED_ISSUES = 10;

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
    const unavailableContextSources: UnavailableContextSource[] = [];

    const linkedPullRequests = await this.getOptionalContext(
      'linked_pull_requests',
      unavailableContextSources,
      () =>
        this.githubClient.getLinkedPullRequests(
          params.owner,
          params.repo,
          params.issueNumber,
        ),
    );
    const boundedLinkedPullRequests = linkedPullRequests.slice(
      -MAX_LINKED_PULL_REQUESTS,
    );

    const checkRuns: StatusCheckRunContext[] = [];
    for (const pullRequest of boundedLinkedPullRequests) {
      const runs = await this.getOptionalContext(
        'check_runs',
        unavailableContextSources,
        () =>
          this.githubClient.getCheckRunsForRef(
            params.owner,
            params.repo,
            pullRequest.headSha,
          ),
      );
      checkRuns.push(
        ...runs.slice(-MAX_CHECK_RUNS_PER_PULL_REQUEST).map((run) => ({
          pullRequestNumber: pullRequest.number,
          ref: pullRequest.headSha,
          ...run,
        })),
      );
    }

    const relatedIssues = await this.getOptionalContext(
      'related_issues',
      unavailableContextSources,
      () =>
        this.githubClient.getRelatedIssues(
          params.owner,
          params.repo,
          params.issueNumber,
        ),
    );

    return {
      issue,
      repositoryLabels: labels,
      recentComments: commentContext.recentComments,
      appComments: commentContext.appComments,
      scheduledFollowUps,
      linkedPullRequests: boundedLinkedPullRequests,
      checkRuns,
      relatedIssues: relatedIssues.slice(-MAX_RELATED_ISSUES),
      unavailableContextSources: dedupeUnavailableSources(
        unavailableContextSources,
      ),
    };
  }

  private async getOptionalContext<T>(
    source: UnavailableContextSource['source'],
    unavailableContextSources: UnavailableContextSource[],
    load: () => Promise<T[]>,
  ): Promise<T[]> {
    try {
      return await load();
    } catch (error) {
      unavailableContextSources.push({
        source,
        reason: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }
}

function dedupeUnavailableSources(
  sources: UnavailableContextSource[],
): UnavailableContextSource[] {
  const bySource = new Map<string, UnavailableContextSource>();
  for (const source of sources) {
    if (!bySource.has(source.source)) {
      bySource.set(source.source, source);
    }
  }
  return [...bySource.values()];
}
