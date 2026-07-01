import { RepositoryLabel } from '../../github-client/interfaces/github-client.interface';

export interface IssueTemplateFieldContext {
  name: string;
  value: string;
  missing: boolean;
}

/**
 * Bounded context packet for the issue triage workflow.
 * All fields are plain data - issue body is treated as untrusted user content.
 */
export interface IssueTriageContext {
  /** Fixed event type for triage context. */
  eventType: 'issues.opened';

  /** Repository metadata. */
  repository: {
    id: number;
    fullName: string;
    defaultBranch: string;
  };

  /** Issue metadata. Body is UNTRUSTED user input. */
  issue: {
    number: number;
    title: string;
    body: string;
    author: string;
    createdAt: string;
  };

  /** Webhook event sender. */
  sender: {
    login: string;
  };

  /** All labels available in the repository. */
  repositoryLabels: RepositoryLabel[];

  /** Labels currently applied to this issue. */
  currentIssueLabels: string[];

  /** Markdown template fields parsed from the issue body, if present. */
  templateFields: IssueTemplateFieldContext[];

  /** Triage configuration. */
  config: {
    /** If set, only these labels may be applied by the AI. */
    labelAllowlist: string[] | null;
    /** Maximum number of labels to apply in a single triage. Default: 5. */
    maxLabels: number;
  };
}
