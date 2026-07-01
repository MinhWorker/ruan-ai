import { IssueComment } from '../github-client/interfaces/github-client.interface';

export type IssueCommentSourceType =
  | 'human_comment'
  | 'human_command'
  | 'app_generated'
  | 'bot_command'
  | 'bot_comment';

export interface ContextIssueComment extends IssueComment {
  sourceType: IssueCommentSourceType;
  workflowMarker?: string;
  logicalMarker?: string;
}

export interface IssueCommentContext {
  recentComments: ContextIssueComment[];
  appComments: ContextIssueComment[];
}

const DEFAULT_RECENT_COMMENT_LIMIT = 10;
const DEFAULT_APP_COMMENT_LIMIT = 10;
const WORKFLOW_MARKER_PATTERN = /<!--\s*ruan-ai:workflow=([^\s>]+)/;
const LOGICAL_MARKER_PATTERN = /\blogical=([^\s>]+)/;
const COMMAND_PATTERN =
  /(?:^|\s)@[\w.-]+(?:\[bot\])?\s+\/(?:plan|split|status|blocker|stop)\b/i;

export function buildIssueCommentContext(
  comments: IssueComment[],
  options: {
    recentLimit?: number;
    appLimit?: number;
  } = {},
): IssueCommentContext {
  const recentLimit = options.recentLimit ?? DEFAULT_RECENT_COMMENT_LIMIT;
  const appLimit = options.appLimit ?? DEFAULT_APP_COMMENT_LIMIT;
  const classifiedComments = comments.map(classifyIssueComment);

  const appComments = classifiedComments
    .filter((comment) => comment.sourceType === 'app_generated')
    .slice(-appLimit);

  const recentComments = classifiedComments
    .filter((comment) => isRecentDiscussionComment(comment))
    .slice(-recentLimit);

  return {
    recentComments,
    appComments,
  };
}

export function classifyIssueComment(
  comment: IssueComment,
): ContextIssueComment {
  const workflowMarker = comment.body.match(WORKFLOW_MARKER_PATTERN)?.[1];
  const logicalMarker = comment.body.match(LOGICAL_MARKER_PATTERN)?.[1];
  const isBotAuthor = comment.author.endsWith('[bot]');
  const isCommand = COMMAND_PATTERN.test(comment.body);

  if (workflowMarker) {
    return {
      ...comment,
      sourceType: 'app_generated',
      workflowMarker,
      logicalMarker,
    };
  }

  if (isBotAuthor && isCommand) {
    return {
      ...comment,
      sourceType: 'bot_command',
    };
  }

  if (isBotAuthor) {
    return {
      ...comment,
      sourceType: 'bot_comment',
    };
  }

  return {
    ...comment,
    sourceType: isCommand ? 'human_command' : 'human_comment',
  };
}

function isRecentDiscussionComment(comment: ContextIssueComment): boolean {
  return (
    comment.sourceType === 'human_comment' ||
    comment.sourceType === 'human_command'
  );
}
