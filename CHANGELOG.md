# Changelog

## SamBetterCode 汉化升级（2026-07-22）

### 升级

- 基于 BetterCode 上游 `main` 分支提交 `d8b0248f70b2` 完成源码升级与独立品牌迭代。
- 将用户可见品牌统一为 SamBetterCode，并保留历史内部标识以兼容既有安装和数据。
- 完成 onboarding、主界面、设置、项目、对话、Git、终端、Provider、Ralph、差异查看、错误和空状态的简体中文本地化。
- 增加中文字体回退、中文换行和桌面布局适配，兼顾明暗主题与窄窗口。
- 新建对话默认名称调整为“新建对话”，同时继续兼容历史数据中的 `New Chat`。
- 重写中文 README 与贡献指南，补充环境要求、登录方式、构建、隐私和兼容性说明。

### 兼容性

- 保留 npm 包名 `bettercode-desktop`、Electron `appId`、深层链接协议、`.bettercode/worktrees`、更新缓存和 Windows AppUserModelId。
- 保留 `LICENSE`、`NOTICE` 及上游英文历史版本记录。


## [0.0.15]

### Changed

- Updated Claude, Codex, OpenCode, and AI SDK dependencies to latest versions
- Added OpenCode provider-list timeouts and clearer unavailable-state handling
- Fixed renderer startup crash caused by non-array provider payloads in dev

## [0.0.14]

### Added

- Claude Opus 4.6 model support with enhanced coding capabilities
- GPT-5.3-Codex model support for improved code generation

## [0.0.13]

### Added

- Project file indexing with SQLite and FTS5 for fast search
- Desktop notifications preferences with notifications integrated into chat flow
- Path-segment fuzzy matching for enhanced file search

### Changed

- Enhanced multi-repo support with refactored diff management
- Exclude noisy files from diffs for cleaner output
- Code cleanup and improved readability across codebase
- Removed console logs from file watcher and project diff management hooks

## [0.0.12]

### Added

- Message queue system for streaming messages with UI display for queued messages
- Message queue display integrated into sub-chat status card

### Removed

- Standalone message queue component (consolidated into status card)

## [0.0.11]

### Added

- Live updates for diff stats during streaming with regular refresh intervals
- Status cache for git status results with file watcher integration for real-time updates
- Plan mode support for Codex and OpenCode providers with function call item handling
- Batch discard changes for multiple files with enhanced selection handling in changes file list
- Output buffer for terminal sessions with enhanced log retrieval

### Changed

- Enhanced worktree cleanup during project deletion
- Improved chat deletion confirmation dialog in UI
- Updated screenshot for improved visual representation

### Fixed

- Background color for empty state indicators in sidebar components
- Formatting in Electron application diagram

## [0.0.10]

### Changed

- Removed completion signal check and cleaned up prompt instructions

## [0.0.9]

### Added

- Terminal transparency support for scrollable elements

### Changed

- Refined terminal UI components for cleaner layout and interactions
- Updated README with refreshed screenshots and media assets

## [0.0.8]

### Added

- Provider management features with improved terminal transparency handling
- Local preview viewport presets with better error handling
- Chat view mode integration and sidebar visibility updates

### Removed

- Icon generation and sync-to-public scripts from the package workflow
- Obsolete fizzy-prancing-pinwheel plan document

## [0.0.7]

### Added

- Local dev server preview with runCommand in project settings
- Section collapse states for pinned, recent, and drafts in ChatsSidebar
- Ralph auto-start functionality with backend integration for story continuation
- Project settings dialog state management in ProjectSelectorHeader
- Fallback for auto-continue story handling in processChunk

### Changed

- Worktree path generation now uses branch name instead of chatId
- Enhanced git status watching with max-wait timer for improved event handling
- Background color updated to transparent in SiriOrb and NewChatForm components
- Format on save enabled with explicit quickfix and import organization code actions

### Removed

- Obsolete DIFF.md and OPENCODE.mdx files

## [0.0.6]

### Added

- Centralized keybindings system with customizable overrides
- Session compaction functionality and /compact command
- Per-subchat model overrides (model_id on sub_chats)
- Ralph auto-continue functionality and streamlined PRD workflows
- Windows and Linux build jobs to release CI workflow

### Changed

- Refactored active-chat into extracted hooks (message handling, plan approval, Ralph auto-start, provider/model selection, scroll tracking, state subscriptions)
- Refactored Ralph service to support sub-chat functionality

## [0.0.5]

### Added

- Windows and Linux platform compatibility for shell and terminal handling

### Fixed

- Unix shell command arguments updated for interactive login environment

### Changed

- Streamlined platform checks and improved shell command handling
- Liquid Glass theme updated to use dark variant with improved color definitions
- Reduced maximum height of message bubbles for better UI consistency

## [0.0.4]

### Changed

- Removed unnecessary background styles from UI components for cleaner visuals
- Improved focus handling in chat input and agent content areas
- Refined diff sidebar and file view styling consistency

## [0.0.3]

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
