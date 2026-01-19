import path from "path";

/**
 * Serializes git operations per project to prevent index.lock conflicts.
 * Operations are queued and executed sequentially per project path.
 *
 * This solves the concurrent git operation issue where multiple operations
 * (branch switches, checkouts, status checks) can conflict when running
 * on the same repository simultaneously.
 */
class GitOperationQueue {
  private queues = new Map<string, Promise<unknown>>();
  private activeOperations = new Map<string, string>(); // path -> operation name

  /**
   * Enqueue a git operation for a project path.
   * Operations on the same project are serialized.
   *
   * @param projectPath - The path to the git repository
   * @param operationName - A descriptive name for logging
   * @param operation - The async operation to execute
   */
  async enqueue<T>(
    projectPath: string,
    operationName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const normalizedPath = path.resolve(projectPath);

    // Wait for any pending operation on this project
    const pending = this.queues.get(normalizedPath) || Promise.resolve();

    // Log queue status for debugging
    const currentOp = this.activeOperations.get(normalizedPath);
    if (currentOp) {
      console.log(
        `[GitQueue] Waiting: "${operationName}" queued behind "${currentOp}" for ${normalizedPath}`,
      );
    }

    // Chain this operation
    const newPromise = pending
      .catch(() => {}) // Don't let previous failures block queue
      .then(async () => {
        this.activeOperations.set(normalizedPath, operationName);
        console.log(
          `[GitQueue] Starting: "${operationName}" on ${normalizedPath}`,
        );
        try {
          return await operation();
        } finally {
          this.activeOperations.delete(normalizedPath);
          console.log(
            `[GitQueue] Completed: "${operationName}" on ${normalizedPath}`,
          );
        }
      });

    this.queues.set(normalizedPath, newPromise);

    try {
      return await newPromise;
    } finally {
      // Clean up if this was the last operation
      if (this.queues.get(normalizedPath) === newPromise) {
        this.queues.delete(normalizedPath);
      }
    }
  }

  /**
   * Check if there's an active operation on a project
   */
  isOperationInProgress(projectPath: string): boolean {
    return this.activeOperations.has(path.resolve(projectPath));
  }

  /**
   * Get current operation name for debugging
   */
  getCurrentOperation(projectPath: string): string | undefined {
    return this.activeOperations.get(path.resolve(projectPath));
  }
}

export const gitQueue = new GitOperationQueue();
