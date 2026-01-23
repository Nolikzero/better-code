# BetterCode

A local-first Electron desktop app for AI-powered code assistance with multi-provider support.

[![macOS](https://img.shields.io/badge/macOS-supported-brightgreen)]()
[![Linux](https://img.shields.io/badge/Linux-supported-brightgreen)]()
[![Windows](https://img.shields.io/badge/Windows-experimental-yellow)]()
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

[Download](#installation) | [Documentation](CLAUDE.md) | [Contributing](CONTRIBUTING.md)

---

<!-- Screenshot placeholder: Add main app interface screenshot here -->
<!-- ![BetterCode Screenshot](docs/screenshots/main-interface.png) -->

## Screenshots

<!-- Add screenshots to docs/screenshots/ and uncomment the relevant lines -->

| Main Chat Interface | Terminal Integration |
|:---:|:---:|
| <!-- ![Chat](docs/screenshots/chat-interface.png) --> *Chat interface placeholder* | <!-- ![Terminal](docs/screenshots/terminal.png) --> *Terminal placeholder* |

| Git Changes View | Project Selector |
|:---:|:---:|
| <!-- ![Changes](docs/screenshots/changes-view.png) --> *Changes view placeholder* | <!-- ![Projects](docs/screenshots/project-selector.png) --> *Project selector placeholder* |

## Features

- **AI Chat Modes** - Switch between Plan mode (read-only analysis) and Agent mode (full code execution permissions)
- **Multi-Provider Support** - Use Claude, OpenAI Codex, or OpenCode as your AI backend
- **Project Management** - Link local folders with automatic Git remote detection for GitHub, GitLab, and Bitbucket
- **Git Worktree Isolation** - Each chat session runs in its own isolated Git worktree for safe experimentation
- **Real-time Tool Execution** - Watch bash commands, file edits, and web searches execute live
- **Integrated Terminal** - Full xterm-based terminal with multiple panes and session persistence
- **Change Tracking** - Visual diffs, file change tracking, and PR management
- **Session Resume** - Continue conversations across app restarts with full context preservation
- **VSCode Theme Support** - Import and apply your favorite VSCode themes

## Installation

### Option 1: Download Release

Download the latest release for your platform from the [Releases](https://github.com/21st-dev/1code/releases) page.

### Option 2: Build from Source

**Prerequisites:**
- [Bun](https://bun.sh/) package manager
- Node.js 18+ (for native module compilation)
- Platform-specific:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: Build essentials (`build-essential`, `python3`)
  - **Windows**: Visual Studio Build Tools

```bash
git clone https://github.com/21st-dev/1code.git
cd 1code
bun install
bun run claude:download  # Download Claude CLI binary (required)
bun run build
bun run package:mac      # or package:win, package:linux
```

> **Important:** The `claude:download` step downloads the Claude CLI binary required for agent functionality. Without it, the app will build but agent mode won't work.

### Option 3: Development Setup

```bash
git clone https://github.com/21st-dev/1code.git
cd 1code
bun install
bun run claude:download  # First time only
bun run dev              # Start with hot reload
```

## Quick Start

1. **Launch the app** - Open BetterCode after installation
2. **Complete onboarding** - Sign in with your Claude account or configure your preferred AI provider
3. **Add a project** - Click "Add Project" and select a local folder (Git repos are auto-detected)
4. **Start chatting** - Choose Plan or Agent mode and begin your coding session

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                      │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Main Process  │     Preload     │    Renderer Process     │
│   (Node.js)     │   (IPC Bridge)  │       (React 19)        │
├─────────────────┼─────────────────┼─────────────────────────┤
│ • tRPC Routers  │ • Context       │ • Tailwind CSS          │
│ • SQLite DB     │   Isolation     │ • Radix UI Components   │
│ • Git Ops       │ • desktopApi    │ • Jotai/Zustand State   │
│ • AI Providers  │   Exposure      │ • React Query           │
│ • Terminal PTY  │                 │ • xterm Terminal        │
└─────────────────┴─────────────────┴─────────────────────────┘
```

For detailed architecture documentation, see [CLAUDE.md](CLAUDE.md).

## Tech Stack

| Layer | Technologies |
|-------|--------------|
| Desktop | Electron, electron-vite, electron-builder |
| Frontend | React 19, TypeScript, Tailwind CSS |
| Components | Radix UI, Lucide icons, Motion |
| State | Jotai, Zustand, React Query |
| Backend | tRPC, Drizzle ORM, better-sqlite3 |
| AI | Claude SDK, Codex SDK, Vercel AI SDK |
| Terminal | xterm, node-pty |
| Git | simple-git |

## Development

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development with hot reload |
| `bun run build` | Production build |
| `bun run package:mac` | Package for macOS (DMG + ZIP) |
| `bun run package:win` | Package for Windows (NSIS) |
| `bun run package:linux` | Package for Linux (AppImage + DEB) |
| `bun run db:generate` | Generate database migrations |
| `bun run db:push` | Push schema directly (dev only) |
| `bun run lint` | Run Biome linter |
| `bun run format` | Format code with Biome |
| `bun run typecheck` | TypeScript type checking |

### Database

BetterCode uses SQLite with Drizzle ORM. The database is stored at `{userData}/data/agents.db` and migrations run automatically on startup.

```bash
bun run db:generate  # Generate migrations after schema changes
bun run db:studio    # Open Drizzle Studio for database inspection
```

## Documentation

- [Architecture Guide](CLAUDE.md) - Detailed codebase structure and patterns
- [Apple Signing Setup](docs/apple-signing-setup.md) - macOS code signing and notarization
- [Contributing Guide](CONTRIBUTING.md) - How to contribute to BetterCode

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork and clone the repo
git clone https://github.com/YOUR_USERNAME/1code.git
cd 1code

# Install dependencies
bun install

# Create a branch for your feature
git checkout -b feature/your-feature

# Make changes, then submit a PR
```

## Attribution

BetterCode is derived from [21st-dev/1code](https://github.com/21st-dev/1code), licensed under the Apache License 2.0.

## License

Apache License 2.0 - see [LICENSE](LICENSE) for details.
