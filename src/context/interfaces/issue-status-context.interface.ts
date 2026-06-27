import {
  IssueData,
  IssueComment,
  RepositoryLabel,
} from '../../github-client/interfaces/github-client.interface';
import { FollowUpRecord } from '../../job/interfaces/follow-up-record.interface';

export interface IssueStatusContext {
  issue: IssueData;
  repositoryLabels: RepositoryLabel[];
  recentComments: IssueComment[];
  appComments: IssueComment[]; // prior triage/plan/split/status/blocker app comments
  scheduledFollowUps: FollowUpRecord[];
}
