import { Injectable, Logger } from '@nestjs/common';
import { GithubClient } from '../../github-client/interfaces/github-client.interface';
import { IssueTriageContext } from '../interfaces/issue-triage-context.interface';

/**
 * Default maximum labels the AI can suggest in a single triage.
 */
const DEFAULT_MAX_LABELS = 5;

/**
 * Maximum allowed length for issue body in the context packet.
 * Truncated beyond this to stay within AI context window bounds.
 */
const MAX_BODY_LENGTH = 10_000;

/**
 * Builds the bounded IssueTriageContext packet for the triage workflow.
 *
 * Key design decisions:
 * - Issue body is included as-is (truncated if huge) — treated as DATA, not instruction.
 * - No sanitization of body content here; that is the AI prompt's and policy's responsibility.
 * - Repository labels are fetched fresh each time to reflect current state.
 */
@Injectable()
export class IssueTriageContextBuilder {
  private readonly logger = new Logger(IssueTriageContextBuilder.name);

  constructor(private readonly githubClient: GithubClient) {}

  async build(params: {
    owner: string;
    repo: string;
    issueNumber: number;
    senderLogin: string;
    labelAllowlist?: string[];
  }): Promise<IssueTriageContext> {
    this.logger.log(
      `Building triage context for ${params.owner}/${params.repo}#${params.issueNumber}`,
    );

    const [repository, issue, repositoryLabels] = await Promise.all([
      this.githubClient.getRepository(params.owner, params.repo),
      this.githubClient.getIssue(params.owner, params.repo, params.issueNumber),
      this.githubClient.getRepositoryLabels(params.owner, params.repo),
    ]);

    const body =
      issue.body.length > MAX_BODY_LENGTH
        ? issue.body.slice(0, MAX_BODY_LENGTH) + '\n[TRUNCATED]'
        : issue.body;

    return {
      eventType: 'issues.opened',
      repository: {
        id: repository.id,
        fullName: repository.fullName,
        defaultBranch: repository.defaultBranch,
      },
      issue: {
        number: issue.number,
        title: issue.title,
        body,
        author: issue.author,
        createdAt: issue.createdAt,
      },
      sender: {
        login: params.senderLogin,
      },
      repositoryLabels,
      currentIssueLabels: issue.labels,
      config: {
        labelAllowlist: params.labelAllowlist ?? null,
        maxLabels: DEFAULT_MAX_LABELS,
      },
    };
  }
}
