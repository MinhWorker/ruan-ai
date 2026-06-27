import {
  IssueData,
  IssueComment,
} from '../../github-client/interfaces/github-client.interface';

export interface IssueBlockerContext {
  issue: IssueData;
  recentComments: IssueComment[];
  activePlanComment?: string;
  activeSplitComment?: string;
  activeStatusComment?: string;
  blockerTriggeringText: string;
}
