export type NormalizedEventType = 'issue' | 'comment' | 'installation';

export interface NormalizedBaseEvent {
  eventType: NormalizedEventType;
  action: string;
  sender: {
    login: string;
    id: number;
  };
}

export interface NormalizedIssueEvent extends NormalizedBaseEvent {
  eventType: 'issue';
  action: 'opened' | 'edited' | 'reopened';
  issueNumber: number;
  title: string;
  body: string;
  repositoryId: number;
}

export interface NormalizedCommentEvent extends NormalizedBaseEvent {
  eventType: 'comment';
  action: 'created';
  issueNumber: number;
  commentId: number;
  body: string;
  repositoryId: number;
  commands: string[];
}

export interface NormalizedInstallationEvent extends NormalizedBaseEvent {
  eventType: 'installation';
  action: 'created' | 'deleted';
  installationId: number;
  repositoryIds: number[];
}

export type NormalizedEvent =
  | NormalizedIssueEvent
  | NormalizedCommentEvent
  | NormalizedInstallationEvent;
