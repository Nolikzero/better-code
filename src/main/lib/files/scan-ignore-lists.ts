/** Directories to skip when scanning project files */
export const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "release",
  ".next",
  ".nuxt",
  ".output",
  "coverage",
  "__pycache__",
  ".venv",
  "venv",
  ".cache",
  ".turbo",
  ".vercel",
  ".netlify",
  "out",
  ".svelte-kit",
  ".astro",
]);

/** Individual files to skip */
export const IGNORED_FILES = new Set([".DS_Store", "Thumbs.db", ".gitkeep"]);

/** File extensions to skip (except for allowed lock files) */
export const IGNORED_EXTENSIONS = new Set([
  ".log",
  ".lock",
  ".pyc",
  ".pyo",
  ".class",
  ".o",
  ".obj",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
]);

/** Lock files that should NOT be ignored despite having .lock extension */
export const ALLOWED_LOCK_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
]);
