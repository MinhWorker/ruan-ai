import { RepositoryLabel } from '../../github-client/interfaces/github-client.interface';
import { ContextIssueComment } from '../comment-context';

export interface IssuePlanContext {
  eventType: 'comment.created';
  repository: {
    id: number;
    fullName: string;
    defaultBranch: string;
  };
  issue: {
    number: number;
    title: string;
    body: string;
    author: string;
    createdAt: string;
  };
  sender: {
    login: string;
  };
  repositoryLabels: RepositoryLabel[];
  currentIssueLabels: string[];
  recentComments: ContextIssueComment[];
  priorTriageComment?: string;
  priorPlanComment?: string;
  config: {
    defaultConfidenceThreshold?: string;
  };
}
