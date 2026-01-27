/**
 * Barrel re-export for worktree-related modules.
 * Split from a single 1,294-line file into focused modules:
 * - git-error-handling.ts — Error types, patterns, categorization
 * - branch-detection.ts — Branch detection, checkout, listing
 * - worktree-lifecycle.ts — Worktree create/remove, LFS, git status
 * - diff-generation.ts — getWorktreeDiff, getWorktreeNumstat
 */

// Branch detection & operations
export {
  branchExistsOnRemote,
  type CheckoutSafetyResult,
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
// Diff generation
export { getWorktreeDiff, getWorktreeNumstat } from "./diff-generation";
// Error handling
export {
  type BranchExistsResult,
  categorizeGitError,
  type ExecFileException,
  GIT_ERROR_PATTERNS,
  GIT_EXIT_CODES,
  isEnoent,
  isExecFileException,
  sanitizeGitError,
} from "./git-error-handling";
// Worktree lifecycle
export {
  commitWorktreeChanges,
  createWorktreeForChat,
  getGitRoot,
  getGitStatus,
  mergeWorktreeToMain,
  pushWorktreeBranch,
  removeWorktree,
  type WorktreeResult,
  worktreeExists,
} from "./worktree-lifecycle";
