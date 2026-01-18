// ============================================
// RE-EXPORT FROM FEATURES/AGENTS/ATOMS (source of truth for agent-specific atoms)
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
} from "../../features/agents/atoms";

// ============================================
// RE-EXPORT FROM DOMAIN-SPECIFIC ATOM FILES
// ============================================

// App state atoms
export {
  isDesktopAtom,
  isFullscreenAtom,
  updateStateAtom,
  justUpdatedAtom,
  justUpdatedVersionAtom,
  updateInfoAtom,
  onboardingCompletedAtom,
  selectedTeamIdAtom,
  createTeamDialogOpenAtom,
  type UpdateStatus,
  type UpdateState,
  type UpdateInfo,
} from "./app.atoms";

// Settings atoms
export {
  extendedThinkingEnabledAtom,
  soundNotificationsEnabledAtom,
  ctrlTabTargetAtom,
  vscodeCodeThemeLightAtom,
  vscodeCodeThemeDarkAtom,
  selectedFullThemeIdAtom,
  systemLightThemeIdAtom,
  systemDarkThemeIdAtom,
  fullThemeDataAtom,
  allFullThemesAtom,
  type CtrlTabTarget,
  type LiquidGlassOptions,
  type ThemeVibrancy,
  type VSCodeFullTheme,
} from "./settings.atoms";

// Provider atoms
export {
  defaultProviderIdAtom,
  chatProviderOverridesAtom,
  lastSelectedModelByProviderAtom,
  codexSandboxModeAtom,
  codexApprovalPolicyAtom,
  codexReasoningEffortAtom,
  PROVIDER_MODELS,
  PROVIDER_INFO,
  SANDBOX_MODES,
  APPROVAL_POLICIES,
  REASONING_EFFORTS,
  type ProviderId,
  type SandboxMode,
  type ApprovalPolicy,
  type ReasoningEffort,
  type ProviderConfigUI,
} from "./providers.atoms";

// Dialog atoms
export {
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  agentsShortcutsDialogOpenAtom,
  agentsLoginModalOpenAtom,
  agentsHelpPopoverOpenAtom,
  agentsQuickSwitchOpenAtom,
  agentsQuickSwitchSelectedIndexAtom,
  subChatsQuickSwitchOpenAtom,
  subChatsQuickSwitchSelectedIndexAtom,
  type SettingsTab,
} from "./dialogs.atoms";

// Selection atoms
export {
  selectedAgentChatIdsAtom,
  isAgentMultiSelectModeAtom,
  selectedAgentChatsCountAtom,
  toggleAgentChatSelectionAtom,
  selectAllAgentChatsAtom,
  clearAgentChatSelectionAtom,
  selectedSubChatIdsAtom,
  isSubChatMultiSelectModeAtom,
  selectedSubChatsCountAtom,
  toggleSubChatSelectionAtom,
  selectAllSubChatsAtom,
  clearSubChatSelectionAtom,
} from "./selection.atoms";

// Session atoms
export {
  sessionInfoAtom,
  type SessionInfo,
  type MCPServerStatus,
  type MCPServer,
} from "./session.atoms";

// ============================================
// BACKWARD COMPATIBILITY - Re-export ProviderConfig as alias
// ============================================

// Some files may import ProviderConfig expecting the UI type
export type { ProviderConfigUI as ProviderConfig } from "./providers.atoms";
