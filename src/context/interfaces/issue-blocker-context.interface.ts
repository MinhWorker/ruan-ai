import { IssueData } from '../../github-client/interfaces/github-client.interface';
import { ContextIssueComment } from '../comment-context';

export interface IssueBlockerContext {
  issue: IssueData;
  recentComments: ContextIssueComment[];
  activePlanComment?: string;
  activeSplitComment?: string;
  activeStatusComment?: string;
  blockerTriggeringText: string;
}
