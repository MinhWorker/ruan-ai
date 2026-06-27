import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { TriageOutput } from './triage-output.interface';
import { IssuePlanContext } from '../../context/interfaces/issue-plan-context.interface';
import { PlanOutput } from './plan-output.interface';
import { IssueSplitContext } from '../../context/interfaces/issue-split-context.interface';
import { SplitOutput } from './split-output.interface';
import { IssueStatusContext } from '../../context/interfaces/issue-status-context.interface';
import { StatusOutput } from './status-output.interface';
import { IssueBlockerContext } from '../../context/interfaces/issue-blocker-context.interface';
import { BlockerOutput } from './blocker-output.interface';

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
   * Perform status analysis and return structured output.
   */
  abstract status(context: IssueStatusContext): Promise<StatusOutput>;

  /**
   * Perform blocker analysis and return structured output.
   */
  abstract blocker(context: IssueBlockerContext): Promise<BlockerOutput>;

  /**
   * Request repair of invalid schema output using validation errors.
   * @param validationErrors - The schema validation errors from the first attempt.
   * @param contextSummary - A brief description of the workflow context.
   * @param targetWorkflow - The workflow name whose schema the repair must satisfy.
   */
  abstract repair(
    validationErrors: string[],
    contextSummary: string,
    targetWorkflow: string,
  ): Promise<any>;

  /**
   * Check if a model is available.
   */
  abstract checkModel(modelId: string): Promise<boolean>;
}
