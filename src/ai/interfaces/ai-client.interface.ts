import { IssueTriageContext } from '../../context/interfaces/issue-triage-context.interface';
import { TriageOutput } from './triage-output.interface';

/**
 * Abstract AI client interface for triage operations.
 * Implementations: FakeTriageAiClient (tests/dev), real Google AI Studio client (future).
 */
export abstract class AiClient {
  /**
   * Perform issue triage analysis and return structured output.
   * The implementation must return a valid TriageOutput or throw.
   */
  abstract triage(context: IssueTriageContext): Promise<TriageOutput>;
}
