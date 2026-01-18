# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

**BetterCode** - A local-first Electron desktop app for AI-powered code assistance. Users create chat sessions linked to local project folders, interact with Claude in Plan or Agent mode, and see real-time tool execution (bash, file edits, web search, etc.).

## Commands

```bash
# Development
bun run dev              # Start Electron with hot reload

# Build
bun run build            # Compile app
bun run package          # Package for current platform (dir)
bun run package:mac      # Build macOS (DMG + ZIP)
bun run package:win      # Build Windows (NSIS + portable)
bun run package:linux    # Build Linux (AppImage + DEB)

# Database (Drizzle + SQLite)
bun run db:generate      # Generate migrations from schema
bun run db:push          # Push schema directly (dev only)
```

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window lifecycle
│   ├── windows/main.ts      # Window creation, IPC handlers
│   └── lib/
│       ├── db/              # Drizzle + SQLite
│       │   ├── index.ts     # DB init, auto-migrate on startup
│       │   ├── schema/      # Drizzle table definitions
│       │   └── utils.ts     # ID generation
│       ├── git/             # Git operations
│       │   ├── branches.ts, staging.ts, status.ts, worktree.ts
│       │   ├── github/      # GitHub API integration
│       │   ├── gitlab/      # GitLab API integration
│       │   └── providers/   # Git provider abstraction
│       ├── providers/       # AI provider abstraction
│       │   ├── claude/      # Claude SDK integration
│       │   ├── codex/       # OpenAI Codex integration
│       │   └── registry.ts  # Provider registration
│       ├── terminal/        # Terminal session management
│       │   ├── manager.ts   # Terminal lifecycle
│       │   ├── session.ts   # PTY sessions
│       │   └── port-manager.ts
│       ├── trpc/routers/    # tRPC routers (13+ routers)
│       ├── auto-updater.ts  # Electron auto-update
│       └── config.ts        # App configuration
│
├── preload/                 # IPC bridge (context isolation)
│   └── index.ts             # Exposes desktopApi + tRPC bridge
│
└── renderer/                # React 19 UI
    ├── App.tsx              # Root with providers
    ├── features/
    │   ├── agents/          # Main chat interface
    │   │   ├── main/        # active-chat.tsx, new-chat-form.tsx
    │   │   ├── ui/          # Tool renderers, preview, diff view
    │   │   ├── commands/    # Slash commands (/plan, /agent, /clear)
    │   │   ├── atoms/       # Jotai atoms for agent state (50+)
    │   │   └── stores/      # Zustand store for sub-chats
    │   ├── changes/         # Git diff view, file changes
    │   ├── terminal/        # Terminal UI (xterm-based)
    │   ├── onboarding/      # New user onboarding flow
    │   ├── sidebar/         # Chat list, archive, navigation
    │   └── layout/          # Main layout with resizable panels
    ├── components/
    │   ├── ui/              # Radix UI wrappers (button, dialog, etc.)
    │   └── dialogs/         # Modal dialogs
    └── lib/
        ├── atoms/           # Global Jotai atoms
        ├── stores/          # Global Zustand stores
        ├── themes/          # VSCode theme support
        ├── hooks/           # Shared React hooks
        ├── utils/           # Utility functions
        └── trpc.ts          # tRPC client
```

## Database (Drizzle ORM)

**Location:** `{userData}/data/agents.db` (SQLite)

**Schema:** `src/main/lib/db/schema/index.ts`

```typescript
// Four main tables:
projects              → id, name, path, gitRemoteUrl, gitProvider, gitOwner, gitRepo, timestamps
chats                 → id, name, projectId, archivedAt, worktreePath, branch, baseBranch, prUrl, prNumber, providerId, timestamps
sub_chats             → id, name, chatId, sessionId, streamId, mode, messages (JSON), providerId, timestamps
claudeCodeCredentials → id, oauthToken, connectedAt, userId
```

**Auto-migration:** On app start, `initDatabase()` runs migrations from `drizzle/` folder (dev) or `resources/migrations` (packaged).

**Queries:**
```typescript
import { getDatabase, projects, chats } from "../lib/db"
import { eq } from "drizzle-orm"

const db = getDatabase()
const allProjects = db.select().from(projects).all()
const projectChats = db.select().from(chats).where(eq(chats.projectId, id)).all()
```

## Key Patterns

### IPC Communication
- Uses **tRPC** with `trpc-electron` for type-safe main↔renderer communication
- All backend calls go through tRPC routers, not raw IPC
- Preload exposes `window.desktopApi` for native features (window controls, clipboard, notifications)

### State Management
- **Jotai**: UI state with 50+ atoms across multiple files
  - Chat/selection atoms (selectedAgentChatIdAtom, previousAgentChatIdAtom)
  - Preview atoms (previewPathAtomFamily, viewportModeAtomFamily)
  - Sidebar atoms (agentsSidebarOpenAtom, diffSidebarOpenAtomFamily)
  - Provider atoms (defaultProviderIdAtom, chatProviderOverridesAtom)
  - Settings atoms (themes, extended thinking, sound notifications)
- **Zustand**: Sub-chat tabs, pinned state, git changes view (persisted to localStorage)
- **React Query**: Server state via tRPC (auto-caching, refetch)

### AI Provider Integration
- Multi-provider abstraction layer (`src/main/lib/providers/`)
- Supported providers: Claude (claude-code SDK), Codex (OpenAI)
- Two modes: "plan" (read-only) and "agent" (full permissions)
- Session resume via `sessionId` stored in SubChat
- Message streaming via Vercel AI SDK (@ai-sdk/react)

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 33.4.5, electron-vite, electron-builder, electron-updater |
| UI | React 19, TypeScript 5.4.5, Tailwind CSS |
| Components | Radix UI, Lucide icons, Motion, Sonner |
| State | Jotai, Zustand, React Query |
| Backend | tRPC, Drizzle ORM, better-sqlite3 |
| AI | @anthropic-ai/claude-code, @anthropic-ai/claude-agent-sdk, @ai-sdk/react, ai (Vercel) |
| Terminal | xterm, node-pty |
| Git | simple-git |
| Code Highlighting | shiki |
| Linting/Formatting | Biome |
| Package Manager | bun |

## File Naming

- Components: PascalCase (`ActiveChat.tsx`, `AgentsSidebar.tsx`)
- Utilities/hooks: camelCase (`useFileUpload.ts`, `formatters.ts`)
- Stores: kebab-case (`sub-chat-store.ts`, `agent-chat-store.ts`)
- Atoms: camelCase with `Atom` suffix (`selectedAgentChatIdAtom`)

## Important Files

- `electron.vite.config.ts` - Build config (main/preload/renderer entries)
- `src/main/lib/db/schema/index.ts` - Drizzle schema (source of truth)
- `src/main/lib/db/index.ts` - DB initialization + auto-migrate
- `src/main/lib/providers/` - AI provider abstraction (Claude, Codex)
- `src/main/lib/git/` - Git operations, worktrees, GitHub/GitLab integration
- `src/main/lib/terminal/` - Terminal session management
- `src/renderer/features/agents/atoms/index.ts` - Agent UI state atoms (50+)
- `src/renderer/features/agents/main/active-chat.tsx` - Main chat component
- `src/renderer/features/changes/` - Git diff and changes UI
- `src/renderer/lib/themes/` - VSCode theme support

## Debugging First Install Issues

When testing auth flows or behavior for new users, you need to simulate a fresh install:

```bash
# 1. Clear all app data (auth, database, settings)
rm -rf ~/Library/Application\ Support/BetterCode\ Dev/

# 2. Reset macOS protocol handler registration (if testing deep links)
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user

# 3. Clear app preferences
defaults delete dev.bettercode.dev  # Dev mode
defaults delete dev.bettercode      # Production

# 4. Run in dev mode with clean state
cd apps/desktop
bun run dev
```

**Common First-Install Bugs:**
- **OAuth deep link not working**: macOS Launch Services may not immediately recognize protocol handlers on first app launch. User may need to click "Sign in" again after the first attempt.
- **Folder dialog not appearing**: Window focus timing issues on first launch. Fixed by ensuring window focus before showing `dialog.showOpenDialog()`.

**Dev vs Production App:**
- Dev mode uses `bettercode-dev://` protocol
- Dev mode uses separate userData path (`~/Library/Application Support/BetterCode Dev/`)
- This prevents conflicts between dev and production installs

## Releasing a New Version

### Prerequisites for Notarization

Set environment variables (add to `.zshrc` or `.env.local`):

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password from appleid.apple.com
```

### Release Commands

```bash
# Full release (build, sign, notarize, generate manifests, upload to CDN)
bun run release

# Or step by step:
bun run build              # Compile TypeScript
bun run package:mac        # Build, sign & notarize macOS app
bun run dist:manifest      # Generate latest-mac.yml manifests
./scripts/upload-release-wrangler.sh  # Upload to R2 CDN
```

### Bump Version Before Release

```bash
npm version patch  # 0.0.2 → 0.0.3
npm version minor  # 0.0.3 → 0.1.0
npm version major  # 0.1.0 → 1.0.0
```

### Files Uploaded to CDN

| File | Purpose |
|------|---------|
| `latest-mac.yml` | Manifest for arm64 auto-updates |
| `latest-mac-x64.yml` | Manifest for Intel auto-updates |
| `BetterCode-{version}-arm64-mac.zip` | Auto-update payload (arm64) |
| `BetterCode-{version}-mac.zip` | Auto-update payload (Intel) |
| `BetterCode-{version}-arm64.dmg` | Manual download (arm64) |
| `BetterCode-{version}.dmg` | Manual download (Intel) |

### Auto-Update Flow

1. App checks the update manifest on startup and when window regains focus (with 1 min cooldown)
2. If version in manifest > current version, shows "Update Available" banner
3. User clicks Download → downloads ZIP in background
4. User clicks "Restart Now" → installs update and restarts

## Current Status

**Done:**
- Drizzle ORM with schema (projects, chats, sub_chats, credentials)
- Auto-migration on app startup
- tRPC routers (13+ routers for all features)
- Git integration with worktree support per chat
- GitHub/GitLab provider integration
- Multi-provider AI support (Claude, Codex)
- Terminal integration with xterm/node-pty
- Onboarding flow for new users
- Auto-update system
- VSCode theme support

**In Progress:**
- UI polish and refinements
- Additional AI provider integrations
