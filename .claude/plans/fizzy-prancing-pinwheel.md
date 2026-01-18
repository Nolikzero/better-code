# Plan: Prohibit and Fix Peer/Nested Duplicate Dependencies

## Overview

Configure bun to prevent duplicate dependencies and resolve existing duplicates using package.json `overrides` and bunfig.toml settings.

**Current node_modules size:** 1.3 GB

---

## Current State Analysis

### Identified Duplicates

| Package | Versions Found | Locations | Fixable |
|---------|---------------|-----------|---------|
| **esbuild** | 0.18.20, 0.25.12, 0.27.2 | @esbuild-kit, root, vite | Partial |
| **sharp** | 0.33.5, 0.34.5 | claude-agent-sdk, root | No |
| **minimatch** | 3.x, 9.x (multiple) | Various nested locations | Yes |
| **fs-extra** | 8.x, 9.x, 11.x | @electron/* packages | No |
| **agent-base** | Multiple | make-fetch-happen nested | Yes |

### Root Causes

1. **drizzle-kit → @esbuild-kit/esm-loader → esbuild@0.18.x**
   - drizzle-kit@0.31.8 depends on `@esbuild-kit/esm-loader@^2.5.5`
   - This pulls in `@esbuild-kit/core-utils` which requires `esbuild@0.18.x`
   - Cannot override without potentially breaking drizzle-kit

2. **vite bundles its own esbuild**
   - vite@7.x uses esbuild@0.27.x internally - intentional, not a bug

3. **electron-builder ecosystem**
   - Has complex nested dependencies for cross-platform builds
   - Different versions of fs-extra, minimatch needed by sub-packages

4. **claude-agent-sdk bundles sharp@0.33.5**
   - SDK needs specific sharp version for image processing
   - Our sharp@0.34.5 is dev-only for build tooling

---

## Step 1: Add Package Overrides to package.json

Add `overrides` section to force specific versions for safe-to-deduplicate packages:

**File:** `package.json` (add after `devDependencies`)

```json
{
  "overrides": {
    "minimatch": "9.0.5",
    "brace-expansion": "2.0.2",
    "semver": "7.7.2"
  }
}
```

**What this does:**
- Forces all packages to use the same version of these common utilities
- Reduces nested duplicates in node_modules

**What we're NOT overriding (and why):**
- `esbuild` - drizzle-kit's @esbuild-kit requires 0.18.x, vite requires 0.27.x
- `sharp` - claude-agent-sdk bundles 0.33.x, we need 0.34.x for build
- `fs-extra` - Different major versions have breaking API changes

---

## Step 2: Add trustedDependencies to package.json

**File:** `package.json` (add alongside `overrides`)

```json
{
  "trustedDependencies": [
    "better-sqlite3",
    "node-pty",
    "electron",
    "sharp",
    "@anthropic-ai/claude-agent-sdk"
  ]
}
```

**What this does:**
- Explicitly allows these packages to run their postinstall/install scripts
- Required for native modules that compile binaries
- Improves security by only trusting known packages

**Note:** bunfig.toml stays minimal with just `peer = true`

---

## Step 3: Clean Install

```bash
# Remove existing installations
rm -rf node_modules bun.lockb

# Fresh install with overrides
bun install

# Verify native modules rebuilt
ls -la node_modules/better-sqlite3/build/Release/
```

---

## Step 4: Verify Deduplication

```bash
# Check minimatch versions (should be single version now)
find node_modules -name "package.json" -path "*/minimatch/package.json" \
  -exec grep -l "version" {} \; | wc -l

# Compare node_modules size
du -sh node_modules
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `overrides` and `trustedDependencies` sections |

---

## What Gets Fixed

| Package | Before | After |
|---------|--------|-------|
| minimatch | 3.x + 9.x duplicates | Single 9.0.5 |
| brace-expansion | 1.x + 2.x duplicates | Single 2.0.2 |
| semver | 6.x + 7.x duplicates | Single 7.7.2 |

---

## What Remains (Acceptable)

These duplicates **cannot and should not** be eliminated:

| Package | Reason |
|---------|--------|
| esbuild 0.18/0.25/0.27 | Different tools require specific major versions |
| sharp 0.33/0.34 | SDK vs build tooling, different APIs |
| fs-extra 8/9/11 | Breaking changes between majors |

**Why it's OK:**
1. All are dev/build dependencies, not shipped to users
2. They're isolated in nested node_modules
3. Forcing single versions would break tools

---

## Verification

1. `bun install` - Completes without errors
2. `bun run typecheck` - No type errors
3. `bun run build` - Builds successfully
4. `bun run dev` - App starts and runs
5. `bun run db:generate` - Drizzle works (tests @esbuild-kit compatibility)
6. Compare node_modules size: should decrease ~50-100MB
