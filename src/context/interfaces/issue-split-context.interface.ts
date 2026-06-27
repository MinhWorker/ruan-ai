import {
  RepositoryLabel,
  IssueComment,
} from '../../github-client/interfaces/github-client.interface';

export interface IssueSplitContext {
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
  recentComments: IssueComment[];
  activePlanComment: string;
}
