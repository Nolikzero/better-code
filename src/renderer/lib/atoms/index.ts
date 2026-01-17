import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// ============================================
// RE-EXPORT FROM FEATURES/AGENTS/ATOMS (source of truth)
// ============================================

export {
  // Chat atoms
  selectedAgentChatIdAtom,
  isPlanModeAtom,
  lastSelectedModelIdAtom,
  lastSelectedAgentIdAtom,
  lastSelectedRepoAtom,
  agentsUnseenChangesAtom,
  agentsSubChatUnseenChangesAtom,
  loadingSubChatsAtom,
  setLoading,
  clearLoading,
  MODEL_ID_MAP,
  lastChatModesAtom,

  // Sidebar atoms
  agentsSidebarOpenAtom,
  agentsSidebarWidthAtom,
  agentsSubChatsSidebarModeAtom,
  agentsSubChatsSidebarWidthAtom,

  // Preview atoms
  previewPathAtomFamily,
  viewportModeAtomFamily,
  previewScaleAtomFamily,
  mobileDeviceAtomFamily,
  agentsPreviewSidebarWidthAtom,
  agentsPreviewSidebarOpenAtom,

  // Diff atoms
  agentsDiffSidebarWidthAtom,
  agentsDiffSidebarOpenAtom,
  agentsFocusedDiffFileAtom,
  filteredDiffFilesAtom,
  subChatFilesAtom,

  // Archive atoms
  archivePopoverOpenAtom,
  archiveSearchQueryAtom,
  archiveRepositoryFilterAtom,

  // Scroll & UI state
  agentsScrollPositionsAtom,
  agentsMobileViewModeAtom,

  // Debug mode
  agentsDebugModeAtom,

  // Todos
  currentTodosAtomFamily,

  // AskUserQuestion
  pendingUserQuestionsAtom,

  // Types
  type SavedRepo,
  type SelectedProject,
  type AgentsMobileViewMode,
  type AgentsDebugMode,
  type SubChatFileChange,
} from "../../features/agents/atoms"

// ============================================
// TEAM ATOMS (unique to lib/atoms)
// ============================================

export const selectedTeamIdAtom = atomWithStorage<string | null>(
  "agents:selectedTeamId",
  null,
  undefined,
  { getOnInit: true },
)

export const createTeamDialogOpenAtom = atom<boolean>(false)

// ============================================
// MULTI-SELECT ATOMS - Chats (unique to lib/atoms)
// ============================================

export const selectedAgentChatIdsAtom = atom<Set<string>>(new Set<string>())

export const isAgentMultiSelectModeAtom = atom((get) => {
  return get(selectedAgentChatIdsAtom).size > 0
})

export const selectedAgentChatsCountAtom = atom((get) => {
  return get(selectedAgentChatIdsAtom).size
})

export const toggleAgentChatSelectionAtom = atom(
  null,
  (get, set, chatId: string) => {
    const currentSet = get(selectedAgentChatIdsAtom)
    const newSet = new Set(currentSet)
    if (newSet.has(chatId)) {
      newSet.delete(chatId)
    } else {
      newSet.add(chatId)
    }
    set(selectedAgentChatIdsAtom, newSet)
  },
)

export const selectAllAgentChatsAtom = atom(
  null,
  (_get, set, chatIds: string[]) => {
    set(selectedAgentChatIdsAtom, new Set(chatIds))
  },
)

export const clearAgentChatSelectionAtom = atom(null, (_get, set) => {
  set(selectedAgentChatIdsAtom, new Set())
})

// ============================================
// MULTI-SELECT ATOMS - Sub-Chats (unique to lib/atoms)
// ============================================

export const selectedSubChatIdsAtom = atom<Set<string>>(new Set<string>())

export const isSubChatMultiSelectModeAtom = atom((get) => {
  return get(selectedSubChatIdsAtom).size > 0
})

export const selectedSubChatsCountAtom = atom((get) => {
  return get(selectedSubChatIdsAtom).size
})

export const toggleSubChatSelectionAtom = atom(
  null,
  (get, set, subChatId: string) => {
    const currentSet = get(selectedSubChatIdsAtom)
    const newSet = new Set(currentSet)
    if (newSet.has(subChatId)) {
      newSet.delete(subChatId)
    } else {
      newSet.add(subChatId)
    }
    set(selectedSubChatIdsAtom, newSet)
  },
)

export const selectAllSubChatsAtom = atom(
  null,
  (_get, set, subChatIds: string[]) => {
    set(selectedSubChatIdsAtom, new Set(subChatIds))
  },
)

export const clearSubChatSelectionAtom = atom(null, (_get, set) => {
  set(selectedSubChatIdsAtom, new Set())
})

// ============================================
// DIALOG ATOMS (unique to lib/atoms)
// ============================================

// Settings dialog
export type SettingsTab = "profile" | "appearance" | "preferences" | "provider" | "skills" | "agents" | "mcp" | "debug"
export const agentsSettingsDialogActiveTabAtom = atom<SettingsTab>("profile")
export const agentsSettingsDialogOpenAtom = atom<boolean>(false)

// Preferences - Extended Thinking
// When enabled, Claude will use extended thinking for deeper reasoning (128K tokens)
// Note: Extended thinking disables response streaming
export const extendedThinkingEnabledAtom = atomWithStorage<boolean>(
  "preferences:extended-thinking-enabled",
  false,
  undefined,
  { getOnInit: true },
)

// Preferences - Sound Notifications
// When enabled, play a sound when agent completes work (if not viewing the chat)
export const soundNotificationsEnabledAtom = atomWithStorage<boolean>(
  "preferences:sound-notifications-enabled",
  true,
  undefined,
  { getOnInit: true },
)

// Preferences - Ctrl+Tab Quick Switch Target
// When "workspaces" (default), Ctrl+Tab switches between workspaces, and Opt+Ctrl+Tab switches between agents
// When "agents", Ctrl+Tab switches between agents, and Opt+Ctrl+Tab switches between workspaces
export type CtrlTabTarget = "workspaces" | "agents"
export const ctrlTabTargetAtom = atomWithStorage<CtrlTabTarget>(
  "preferences:ctrl-tab-target",
  "workspaces", // Default: Ctrl+Tab switches workspaces, Opt+Ctrl+Tab switches agents
  undefined,
  { getOnInit: true },
)

// Preferences - VS Code Code Themes
// Selected themes for code syntax highlighting (separate for light/dark UI themes)
export const vscodeCodeThemeLightAtom = atomWithStorage<string>(
  "preferences:vscode-code-theme-light",
  "github-light",
  undefined,
  { getOnInit: true },
)

export const vscodeCodeThemeDarkAtom = atomWithStorage<string>(
  "preferences:vscode-code-theme-dark",
  "github-dark",
  undefined,
  { getOnInit: true },
)

// ============================================
// FULL VS CODE THEME ATOMS
// ============================================

/**
 * Liquid Glass options for macOS 26+ (Tahoe)
 */
export type LiquidGlassOptions = {
  cornerRadius?: number
  tintColor?: string // RGBA hex (e.g., '#44000010')
  opaque?: boolean
}

/**
 * Vibrancy configuration for transparent themes (macOS only)
 */
export type ThemeVibrancy = {
  enabled: boolean
  type: "under-window" | "sidebar" | "content" | "fullscreen-ui"
  visualEffectState?: "followWindow" | "active" | "inactive"
  // Liquid glass options (macOS 26+ Tahoe)
  liquidGlass?: LiquidGlassOptions
}

/**
 * Full VS Code theme data type
 * Contains colors for UI, terminal, and tokenColors for syntax highlighting
 */
export type VSCodeFullTheme = {
  id: string
  name: string
  type: "light" | "dark"
  colors: Record<string, string> // UI and terminal colors
  tokenColors?: any[] // Syntax highlighting rules
  semanticHighlighting?: boolean // Enable semantic highlighting
  semanticTokenColors?: Record<string, any> // Semantic token color overrides
  source: "builtin" | "imported" | "discovered"
  path?: string // File path for imported/discovered themes
  vibrancy?: ThemeVibrancy // Vibrancy configuration for transparent themes
}

/**
 * Selected full theme ID
 * When null, uses system light/dark mode with the themes specified in systemLightThemeIdAtom/systemDarkThemeIdAtom
 */
export const selectedFullThemeIdAtom = atomWithStorage<string | null>(
  "preferences:selected-full-theme-id",
  null, // null means use system default
  undefined,
  { getOnInit: true },
)

/**
 * Theme to use when system is in light mode (only used when selectedFullThemeIdAtom is null)
 */
export const systemLightThemeIdAtom = atomWithStorage<string>(
  "preferences:system-light-theme-id",
  "default-light", // Default light theme
  undefined,
  { getOnInit: true },
)

/**
 * Theme to use when system is in dark mode (only used when selectedFullThemeIdAtom is null)
 */
export const systemDarkThemeIdAtom = atomWithStorage<string>(
  "preferences:system-dark-theme-id",
  "default-dark", // Default dark theme
  undefined,
  { getOnInit: true },
)

/**
 * Cached full theme data for the selected theme
 * This is populated when a theme is selected and used for applying CSS variables
 */
export const fullThemeDataAtom = atom<VSCodeFullTheme | null>(null)

/**
 * All available full themes (built-in + imported + discovered)
 * This is a derived atom that combines all theme sources
 */
export const allFullThemesAtom = atom<VSCodeFullTheme[]>((get) => {
  // This will be populated by the theme provider
  // For now, return empty - will be set imperatively
  return []
})

// Shortcuts dialog
export const agentsShortcutsDialogOpenAtom = atom<boolean>(false)

// Login modal (shown when Claude Code auth fails)
export const agentsLoginModalOpenAtom = atom<boolean>(false)

// Help popover
export const agentsHelpPopoverOpenAtom = atom<boolean>(false)

// Quick switch dialog - Agents
export const agentsQuickSwitchOpenAtom = atom<boolean>(false)
export const agentsQuickSwitchSelectedIndexAtom = atom<number>(0)

// Quick switch dialog - Sub-chats
export const subChatsQuickSwitchOpenAtom = atom<boolean>(false)
export const subChatsQuickSwitchSelectedIndexAtom = atom<number>(0)

// ============================================
// UPDATE ATOMS
// ============================================

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "error"

export type UpdateState = {
  status: UpdateStatus
  version?: string
  progress?: number // 0-100
  bytesPerSecond?: number
  transferred?: number
  total?: number
  error?: string
}

export const updateStateAtom = atom<UpdateState>({ status: "idle" })

// Track if app was just updated (to show "What's New" banner)
// This is set to true when app launches with a new version, reset when user dismisses
export const justUpdatedAtom = atom<boolean>(false)

// Store the version that triggered the "just updated" state
export const justUpdatedVersionAtom = atom<string | null>(null)

// Legacy atom for backwards compatibility (deprecated)
export type UpdateInfo = {
  version: string
  downloadUrl: string
  releaseNotes?: string
}

export const updateInfoAtom = atom<UpdateInfo | null>(null)

// ============================================
// DESKTOP/FULLSCREEN STATE ATOMS
// ============================================

// Whether app is running in Electron desktop environment
export const isDesktopAtom = atom<boolean>(false)

// Fullscreen state - null means not initialized yet
// null = not yet loaded, false = not fullscreen, true = fullscreen
export const isFullscreenAtom = atom<boolean | null>(null)

// ============================================
// ANTHROPIC ONBOARDING ATOMS
// ============================================

// Whether user has completed Anthropic API key setup during onboarding
// Reset on logout
export const anthropicOnboardingCompletedAtom = atomWithStorage<boolean>(
  "onboarding:anthropic-completed",
  false,
  undefined,
  { getOnInit: true },
)

// ============================================
// AI PROVIDER ATOMS
// ============================================

// Available provider IDs
export type ProviderId = "claude" | "codex"

// Provider configuration (for display in UI)
export type ProviderConfig = {
  id: ProviderId
  name: string
  description: string
  available: boolean
  authStatus: {
    authenticated: boolean
    method?: "oauth" | "api-key"
  }
}

// Global default provider (persisted to localStorage)
export const defaultProviderIdAtom = atomWithStorage<ProviderId>(
  "preferences:default-provider",
  "claude", // Default to Claude
  undefined,
  { getOnInit: true },
)

// Per-chat provider overrides (chatId -> providerId)
// When a chat has an override, it uses that provider instead of the default
export const chatProviderOverridesAtom = atomWithStorage<Record<string, ProviderId>>(
  "agents:chatProviderOverrides",
  {},
  undefined,
  { getOnInit: true },
)

// Model selection per provider (providerId -> modelId)
// Each provider has its own last selected model
export const lastSelectedModelByProviderAtom = atomWithStorage<Record<ProviderId, string>>(
  "agents:lastSelectedModelByProvider",
  {
    claude: "sonnet",
    codex: "gpt-5.2-codex",
  },
  undefined,
  { getOnInit: true },
)

// Provider model definitions
export const PROVIDER_MODELS: Record<ProviderId, { id: string; name: string; displayName: string }[]> = {
  claude: [
    { id: "opus", name: "opus", displayName: "Opus 4.5" },
    { id: "sonnet", name: "sonnet", displayName: "Sonnet 4.5" },
    { id: "haiku", name: "haiku", displayName: "Haiku 4.5" },
  ],
  codex: [
    { id: "gpt-5.2-codex", name: "gpt-5.2-codex", displayName: "GPT-5.2 Codex" },
    { id: "gpt-5.1-codex-max", name: "gpt-5.1-codex-max", displayName: "GPT-5.1 Codex Max" },
    { id: "gpt-5.1-codex-mini", name: "gpt-5.1-codex-mini", displayName: "GPT-5.1 Codex Mini" },
    { id: "gpt-5.2", name: "gpt-5.2", displayName: "GPT-5.2" },
  ],
}

// Provider display info
export const PROVIDER_INFO: Record<ProviderId, { name: string; description: string }> = {
  claude: {
    name: "Claude Code",
    description: "Anthropic's Claude AI assistant for coding",
  },
  codex: {
    name: "OpenAI Codex",
    description: "OpenAI's Codex CLI for coding assistance",
  },
}

// ============================================
// CODEX-SPECIFIC SETTINGS
// ============================================

// Sandbox mode (determines file system access level)
export type SandboxMode = "read-only" | "workspace-write" | "danger-full-access"
export const SANDBOX_MODES: { id: SandboxMode; name: string; description: string }[] = [
  { id: "read-only", name: "Read Only", description: "Can read files but cannot make any modifications" },
  { id: "workspace-write", name: "Workspace Write", description: "Can modify files within the project directory" },
  { id: "danger-full-access", name: "Full Access", description: "Unrestricted system access (use with caution)" },
]

export const codexSandboxModeAtom = atomWithStorage<SandboxMode>(
  "codex:sandbox-mode",
  "workspace-write", // Default: safe workspace modifications
  undefined,
  { getOnInit: true },
)

// Approval policy (when to ask for confirmation)
export type ApprovalPolicy = "never" | "on-request" | "untrusted" | "on-failure"
export const APPROVAL_POLICIES: { id: ApprovalPolicy; name: string; description: string }[] = [
  { id: "never", name: "Never (Fully Autonomous)", description: "Execute all commands without asking" },
  { id: "on-request", name: "On Request", description: "Ask when explicitly requested or for risky commands" },
  { id: "untrusted", name: "Untrusted", description: "Auto-approve safe commands, ask for state-changing ones" },
  { id: "on-failure", name: "On Failure", description: "Run autonomously until a command fails" },
]

export const codexApprovalPolicyAtom = atomWithStorage<ApprovalPolicy>(
  "codex:approval-policy",
  "untrusted", // Default: auto-approve safe commands
  undefined,
  { getOnInit: true },
)

// Reasoning effort (controls depth of thinking and cost)
// Valid values: none, minimal, low, medium, high, xhigh
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh"
export const REASONING_EFFORTS: { id: ReasoningEffort; name: string; description: string }[] = [
  { id: "none", name: "None", description: "No additional reasoning" },
  { id: "minimal", name: "Minimal", description: "Very light reasoning" },
  { id: "low", name: "Low", description: "Light reasoning, fast responses" },
  { id: "medium", name: "Medium", description: "Balanced reasoning depth and speed" },
  { id: "high", name: "High", description: "Deeper reasoning for complex tasks" },
  { id: "xhigh", name: "Maximum", description: "Maximum reasoning depth (slowest)" },
]

export const codexReasoningEffortAtom = atomWithStorage<ReasoningEffort>(
  "codex:reasoning-effort",
  "medium", // Default: balanced
  undefined,
  { getOnInit: true },
)

// ============================================
// SESSION INFO ATOMS (MCP, Plugins, Tools)
// ============================================

export type MCPServerStatus = "connected" | "failed" | "pending" | "needs-auth"

export type MCPServer = {
  name: string
  status: MCPServerStatus
  serverInfo?: {
    name: string
    version: string
  }
  error?: string
}

export type SessionInfo = {
  tools: string[]
  mcpServers: MCPServer[]
  plugins: { name: string; path: string }[]
  skills: string[]
}

// Session info from SDK init message
// Contains MCP servers, plugins, available tools, and skills
// Persisted to localStorage so MCP tools are visible after page refresh
// Updated when a new chat session starts
export const sessionInfoAtom = atomWithStorage<SessionInfo | null>(
  "bettercode-session-info",
  null,
  undefined,
  { getOnInit: true },
)
