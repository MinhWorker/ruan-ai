import {
  IssueData,
  RepositoryLabel,
} from '../../github-client/interfaces/github-client.interface';
import { ContextIssueComment } from '../comment-context';
import { FollowUpRecord } from '../../job/interfaces/follow-up-record.interface';

export interface IssueStatusContext {
  issue: IssueData;
  repositoryLabels: RepositoryLabel[];
  recentComments: ContextIssueComment[];
  appComments: ContextIssueComment[]; // prior triage/plan/split/status/blocker app comments
  scheduledFollowUps: FollowUpRecord[];
}
