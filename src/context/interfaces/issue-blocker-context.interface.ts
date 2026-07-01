import {
  IssueData,
  PullRequestContext,
  RelatedIssueContext,
} from '../../github-client/interfaces/github-client.interface';
import { ContextIssueComment } from '../comment-context';
import {
  StatusCheckRunContext,
  UnavailableContextSource,
} from './issue-status-context.interface';

export interface DeploymentSignalContext {
  source: string;
  status: string;
  summary: string;
  url?: string | null;
}

export interface IssueBlockerContext {
  issue: IssueData;
  recentComments: ContextIssueComment[];
  activePlanComment?: string;
  activeSplitComment?: string;
  activeStatusComment?: string;
  blockerTriggeringText: string;
  linkedPullRequests: PullRequestContext[];
  checkRuns: StatusCheckRunContext[];
  relatedIssues: RelatedIssueContext[];
  deploymentSignals: DeploymentSignalContext[];
  unavailableContextSources: UnavailableContextSource[];
}
