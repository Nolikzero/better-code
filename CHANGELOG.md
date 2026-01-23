# Changelog

## [Unreleased]

### Added

- External app detection and launching — open files in VS Code, Xcode, Sublime Text, etc. directly from the app
- "Open In" context menu and dropdown UI components for detected external editors
- Terminal vibrancy/transparency support for Liquid Glass themes (macOS native blur effect)
- CSS backdrop-filter fallback for terminal transparency on Windows/Linux
- Reduced transparency media query support for terminal

### Changed

- Terminal renderer skips GPU-accelerated rendering when transparency is active (GPU renderers don't support alpha)
- Terminal background defers to vibrancy/CSS when Liquid Glass theme is active

## [0.0.2] — Packaging fixes

### Fixed

- Fix `electron-builder: command not found` in GitHub Actions CI
- Fix release asset upload failing with 403 (missing `contents: write` permission)
- Fix `ralph.png` not resolving in packaged app (absolute path → relative path)
- Fix `bun: command not found` (exit code 127) during workspace init in packaged app — shell PATH now derived from user's login shell

### Changed

- macOS builds target Apple Silicon (arm64) only — Intel x64 dropped (GitHub retired x64 macOS runners)

## [0.0.1] — Your desktop AI coding companion is here

The first public release of BetterCode — a local-first desktop app that gives you a proper workspace for coding with AI agents.

Think of it as a native home for Claude, Codex, OpenCode that actually understands your projects, your git workflow, and your terminal.

### Added

- **Plan mode** — Claude reads your code and designs an approach before touching anything
- **Agent mode** — Claude goes full hands-on: edits files, runs commands, searches the web
- **Ralph mode** — Give it a PRD with user stories and let it build features autonomously
- Git worktree isolation per chat — every conversation gets its own branch, no conflicts
- Real-time diff view as Claude makes changes
- One-click PRs to GitHub and GitLab
- Stage, commit, and push without leaving the app
- Built-in PTY terminal (xterm) — see what commands run and jump in anytime
- Live preview with device presets (iPhone, iPad, Android) for responsive testing
- Multi-provider AI support: Claude (Opus 4.5, Sonnet 4.5, Haiku 4.5), OpenAI Codex, OpenCode
- Extended thinking support (128K tokens of reasoning)
- MCP servers for custom tool integrations
- Sub-chat tabs — explore different approaches simultaneously within one chat
- Pin and archive conversations
- 16+ themes including VSCode-compatible and Liquid Glass (macOS vibrancy)
- Full keyboard navigation (`⌘\`, `⌘⇧\`, `Ctrl+Tab`, and more)

### Platform support

- macOS (Apple Silicon + Intel)
- Windows
- Linux (AppImage + DEB)
