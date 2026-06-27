/**
 * Abstract GitHub write client for applying labels and upserting comments.
 * Implementations: FakeGithubWriter (tests/dev), real GitHub REST writer (future milestones).
 */
export abstract class GithubWriter {
  /**
   * Apply labels to an issue. Should be additive (not remove existing labels).
   * Must be idempotent - applying the same labels again is a no-op.
   */
  abstract applyLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[],
  ): Promise<void>;

  /**
   * Create or update a comment identified by a hidden HTML marker.
   * If a comment with the marker already exists, update it.
   * If not found, create a new comment with the marker prepended.
   */
  abstract upsertComment(
    owner: string,
    repo: string,
    issueNumber: number,
    marker: string,
    body: string,
  ): Promise<void>;
}
