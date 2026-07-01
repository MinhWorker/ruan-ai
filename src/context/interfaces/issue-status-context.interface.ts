import {
  IssueData,
  RepositoryLabel,
  PullRequestContext,
  RelatedIssueContext,
} from '../../github-client/interfaces/github-client.interface';
import { ContextIssueComment } from '../comment-context';
import { FollowUpRecord } from '../../job/interfaces/follow-up-record.interface';

export interface StatusCheckRunContext {
  pullRequestNumber: number;
  ref: string;
  name: string;
  status: string;
  conclusion?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl?: string | null;
}

export interface UnavailableContextSource {
  source: 'linked_pull_requests' | 'check_runs' | 'related_issues';
  reason: string;
}

export interface IssueStatusContext {
  issue: IssueData;
  repositoryLabels: RepositoryLabel[];
  recentComments: ContextIssueComment[];
  appComments: ContextIssueComment[]; // prior triage/plan/split/status/blocker app comments
  scheduledFollowUps: FollowUpRecord[];
  linkedPullRequests: PullRequestContext[];
  checkRuns: StatusCheckRunContext[];
  relatedIssues: RelatedIssueContext[];
  unavailableContextSources: UnavailableContextSource[];
}
