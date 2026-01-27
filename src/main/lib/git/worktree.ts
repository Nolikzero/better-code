/**
 * Barrel re-export for worktree-related modules.
 * Split from a single 1,294-line file into focused modules:
 * - git-error-handling.ts — Error types, patterns, categorization
 * - branch-detection.ts — Branch detection, checkout, listing
 * - worktree-lifecycle.ts — Worktree create/remove, LFS, git status
 * - diff-generation.ts — getWorktreeDiff, getWorktreeNumstat
 */

// Error handling
export {
  type BranchExistsResult,
  type ExecFileException,
  GIT_ERROR_PATTERNS,
  GIT_EXIT_CODES,
  categorizeGitError,
  isEnoent,
  isExecFileException,
  sanitizeGitError,
} from "./git-error-handling";

// Branch detection & operations
export {
  type CheckoutSafetyResult,
  branchExistsOnRemote,
  checkBranchCheckoutSafety,
  checkNeedsRebase,
  checkoutBranch,
  detectBaseBranch,
  fetchDefaultBranch,
  getCurrentBranch,
  getDefaultBranch,
  hasUncommittedChanges,
  hasUnpushedCommits,
  listBranches,
  refExistsLocally,
  refreshDefaultBranch,
  safeCheckoutBranch,
} from "./branch-detection";

// Worktree lifecycle
export {
  type WorktreeResult,
  commitWorktreeChanges,
  createWorktreeForChat,
  getGitRoot,
  getGitStatus,
  mergeWorktreeToMain,
  pushWorktreeBranch,
  removeWorktree,
  worktreeExists,
} from "./worktree-lifecycle";

// Diff generation
export { getWorktreeDiff, getWorktreeNumstat } from "./diff-generation";
