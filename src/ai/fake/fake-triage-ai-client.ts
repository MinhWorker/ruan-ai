import { Injectable, Logger } from '@nestjs/common';
import { AiClient } from '../interfaces/ai-client.interface';
import { TriageOutput } from '../interfaces/triage-output.interface';
import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';

/**
 * Deterministic fake AI client for tests and local development.
 *
 * Returns structured triage output based on keyword matching in the issue title:
 * - Title contains "bug" → labels: ["bug"], riskLevel: "medium"
 * - Title contains "feature" → labels: ["enhancement"], riskLevel: "low"
 * - Title contains "security" or "vulnerability" → labels: ["bug"], riskLevel: "high"
 * - Default → labels: ["ruan:needs-info"], riskLevel: "low"
 *
 * Suggested labels are filtered to only include labels that exist in repositoryLabels,
 * matching the real client's expected behavior.
 */
@Injectable()
export class FakeTriageAiClient extends AiClient {
  private readonly logger = new Logger(FakeTriageAiClient.name);

  async triage(context: IssueTriageContext): Promise<TriageOutput> {
    await Promise.resolve();
    this.logger.log(
      `[FAKE AI] Triaging issue #${context.issue.number}: ${context.issue.title}`,
    );

    const title = context.issue.title.toLowerCase();
    const repoLabelNames = new Set(context.repositoryLabels.map((l) => l.name));

    let suggestedLabels: string[];
    let riskLevel: 'low' | 'medium' | 'high';
    let summary: string;

    if (title.includes('security') || title.includes('vulnerability')) {
      suggestedLabels = ['bug'];
      riskLevel = 'high';
      summary = 'Security-related issue requiring immediate attention.';
    } else if (title.includes('bug')) {
      suggestedLabels = ['bug'];
      riskLevel = 'medium';
      summary = 'Bug report requiring investigation.';
    } else if (title.includes('feature')) {
      suggestedLabels = ['enhancement'];
      riskLevel = 'low';
      summary = 'Feature request for evaluation.';
    } else {
      suggestedLabels = ['ruan:needs-info'];
      riskLevel = 'low';
      summary = 'Issue requires further classification and information.';
    }

    // Only suggest labels that actually exist in the repository
    suggestedLabels = suggestedLabels.filter((l) => repoLabelNames.has(l));

    const missingInformation: string[] = [];
    if (!context.issue.body || context.issue.body.trim().length < 20) {
      missingInformation.push(
        'Issue body is too short — please provide more details about the problem or request.',
      );
    }

    const commentBody = this.buildCommentBody(
      summary,
      riskLevel,
      suggestedLabels,
      missingInformation,
    );

    return {
      workflow: 'triage',
      summary,
      riskLevel,
      suggestedLabels,
      missingInformation,
      recommendedNextCommand:
        missingInformation.length > 0 ? 'human_clarification' : '/plan',
      commentBody,
      confidence: riskLevel === 'high' ? 'medium' : 'high',
      assumptions: [],
      evidence: [
        {
          source: 'issue_title',
          content: context.issue.title,
        },
      ],
    };
  }

  private buildCommentBody(
    summary: string,
    riskLevel: string,
    labels: string[],
    missingInfo: string[],
  ): string {
    const lines: string[] = [];
    lines.push(`## Triage Summary\n`);
    lines.push(summary);
    lines.push(`\n**Risk Level:** ${riskLevel}`);

    if (labels.length > 0) {
      lines.push(
        `\n**Suggested Labels:** ${labels.map((l) => '`' + l + '`').join(', ')}`,
      );
    }

    if (missingInfo.length > 0) {
      lines.push(`\n### Missing Information\n`);
      for (const info of missingInfo) {
        lines.push(`- ${info}`);
      }
    }

    return lines.join('\n');
  }
}
