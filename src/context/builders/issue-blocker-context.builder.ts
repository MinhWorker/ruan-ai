import { Injectable } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import {
  DeploymentSignalContext,
  IssueBlockerContext,
} from '../interfaces/issue-blocker-context.interface';
import { buildIssueCommentContext } from '../comment-context';
import {
  StatusCheckRunContext,
  UnavailableContextSource,
} from '../interfaces/issue-status-context.interface';

const MAX_LINKED_PULL_REQUESTS = 5;
const MAX_CHECK_RUNS_PER_PULL_REQUEST = 10;
const MAX_RELATED_ISSUES = 10;
const DEPLOYMENT_SIGNAL_PATTERN =
  /deploy|deployment|staging|cloud build|cloud run/i;

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
    const unavailableContextSources: UnavailableContextSource[] = [];

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
      recentComments: commentContext.recentComments,
      activePlanComment,
      activeSplitComment,
      activeStatusComment,
      blockerTriggeringText: params.triggeringCommentBody,
      linkedPullRequests: boundedLinkedPullRequests,
      checkRuns,
      relatedIssues: relatedIssues.slice(-MAX_RELATED_ISSUES),
      deploymentSignals: buildDeploymentSignals(checkRuns),
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

function buildDeploymentSignals(
  checkRuns: StatusCheckRunContext[],
): DeploymentSignalContext[] {
  return checkRuns
    .filter((run) => DEPLOYMENT_SIGNAL_PATTERN.test(run.name))
    .map((run) => ({
      source: `check_run:${run.name}`,
      status: run.conclusion ?? run.status,
      summary: `PR #${run.pullRequestNumber} deployment signal ${run.name}: ${run.status}/${run.conclusion ?? 'none'}`,
      url: run.detailsUrl,
    }));
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
