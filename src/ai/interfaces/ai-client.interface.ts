import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { TriageOutput } from './triage-output.interface';
import { IssuePlanContext } from '../../context/interfaces/issue-plan-context.interface';
import { PlanOutput } from './plan-output.interface';
import { IssueSplitContext } from '../../context/interfaces/issue-split-context.interface';
import { SplitOutput } from './split-output.interface';

/**
 * Abstract AI client interface for triage, planning, and task splitting operations.
 * Implementations: FakeTriageAiClient (tests/dev), real Google AI Studio client (future).
 */
export abstract class AiClient {
  /**
   * Perform issue triage analysis and return structured output.
   * The implementation must return a valid TriageOutput or throw.
   */
  abstract triage(context: IssueTriageContext): Promise<TriageOutput>;

  /**
   * Perform planning analysis and return structured output.
   */
  abstract plan(context: IssuePlanContext): Promise<PlanOutput>;

  /**
   * Perform task splitting analysis and return structured output.
   */
  abstract split(context: IssueSplitContext): Promise<SplitOutput>;

  /**
   * Request repair of invalid schema output using validation errors.
   */
  abstract repair(
    validationErrors: string[],
    contextSummary: string,
  ): Promise<any>;
}
