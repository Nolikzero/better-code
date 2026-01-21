// ============================================
// RE-EXPORT FROM FEATURES/AGENTS/ATOMS (source of truth for agent-specific atoms)
// ============================================

export {
  // Chat atoms

  // Sidebar atoms
  agentsSidebarOpenAtom,
  agentsSidebarWidthAtom,
  chatsSidebarOpenAtom,
  chatsSidebarWidthAtom,

  // Preview atoms

  // Diff atoms

  // Archive atoms

  // Scroll & UI state

  // Debug mode

  // Todos

  // AskUserQuestion

  // Types
} from "../../features/agents/atoms";

// ============================================
// RE-EXPORT FROM DOMAIN-SPECIFIC ATOM FILES
// ============================================

// App state atoms
export {
  createTeamDialogOpenAtom,
  isDesktopAtom,
  isFullscreenAtom,
  justUpdatedAtom,
  justUpdatedVersionAtom,
  onboardingCompletedAtom,
  selectedTeamIdAtom,
  updateStateAtom,
} from "./app.atoms";
// Dialog atoms
export {
  agentsHelpPopoverOpenAtom,
  agentsLoginModalOpenAtom,
  agentsQuickSwitchOpenAtom,
  agentsQuickSwitchSelectedIndexAtom,
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  agentsShortcutsDialogOpenAtom,
  quickOpenDialogOpenAtom,
  type SettingsTab,
  subChatsQuickSwitchOpenAtom,
  subChatsQuickSwitchSelectedIndexAtom,
} from "./dialogs.atoms";

// Provider atoms
export {
  APPROVAL_POLICIES,
  type ApprovalPolicy,
  chatProviderOverridesAtom,
  codexApprovalPolicyAtom,
  codexReasoningEffortAtom,
  codexSandboxModeAtom,
  codexWebSearchModeAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  PROVIDER_INFO,
  PROVIDER_MODELS,
  type ProviderId,
  REASONING_EFFORTS,
  type ReasoningEffort,
  SANDBOX_MODES,
  type SandboxMode,
  subChatProviderOverridesAtom,
  type WebSearchMode,
} from "./providers.atoms";
// Selection atoms
export {
  clearAgentChatSelectionAtom,
  clearSubChatSelectionAtom,
  isAgentMultiSelectModeAtom,
  isSubChatMultiSelectModeAtom,
  selectAllAgentChatsAtom,
  selectAllSubChatsAtom,
  selectedAgentChatIdsAtom,
  selectedAgentChatsCountAtom,
  selectedSubChatIdsAtom,
  selectedSubChatsCountAtom,
  toggleAgentChatSelectionAtom,
  toggleSubChatSelectionAtom,
} from "./selection.atoms";
// Session atoms
export {
  type MCPServerStatus,
  sessionInfoAtom,
} from "./session.atoms";
// Settings atoms
export {
  type CtrlTabTarget,
  ctrlTabTargetAtom,
  extendedThinkingEnabledAtom,
  fullThemeDataAtom,
  selectedFullThemeIdAtom,
  soundNotificationsEnabledAtom,
  systemDarkThemeIdAtom,
  systemLightThemeIdAtom,
  type VSCodeFullTheme,
  vscodeCodeThemeDarkAtom,
  vscodeCodeThemeLightAtom,
} from "./settings.atoms";
// ============================================
// BACKWARD COMPATIBILITY - Re-export ProviderConfig as alias
// ============================================

// Some files may import ProviderConfig expecting the UI type
