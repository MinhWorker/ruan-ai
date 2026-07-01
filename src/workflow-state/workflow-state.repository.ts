import {
  WorkflowEvent,
  WorkflowState,
  WorkflowType,
} from './interfaces/workflow-state.interface';

export abstract class WorkflowStateRepository {
  abstract saveState(state: WorkflowState): Promise<WorkflowState>;
  abstract findState(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowState | null>;
  abstract appendEvent(event: WorkflowEvent): Promise<WorkflowEvent>;
  abstract findEvents(
    repositoryId: number,
    issueNumber: number,
    workflowType: WorkflowType,
  ): Promise<WorkflowEvent[]>;
}
