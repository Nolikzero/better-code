// ============================================
// RE-EXPORT FROM FEATURES/AGENTS/ATOMS (source of truth for agent-specific atoms)
// ============================================

export {
  // Chat atoms

  // Sidebar atoms
  agentsSidebarOpenAtom,
  agentsSidebarWidthAtom,

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
  isDesktopAtom,
  isFullscreenAtom,
  updateStateAtom,
  justUpdatedAtom,
  justUpdatedVersionAtom,
  onboardingCompletedAtom,
  selectedTeamIdAtom,
  createTeamDialogOpenAtom,
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
  type CtrlTabTarget,
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
  type MCPServerStatus,
} from "./session.atoms";
// ============================================
// BACKWARD COMPATIBILITY - Re-export ProviderConfig as alias
// ============================================

// Some files may import ProviderConfig expecting the UI type
