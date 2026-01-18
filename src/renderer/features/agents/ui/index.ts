// Agent UI Components
// All components are designed to work with mocked data for parallel development

// Provider icons
export { CodexIcon, getProviderIcon, PROVIDERS } from "./provider-icons";

// Chat components
export { AgentSendButton } from "./agent-send-button";
export { AgentUserMessageBubble } from "./agent-user-message-bubble";

// Content components
export { AgentsContent } from "./agents-content";

// Preview components
export { AgentPreview } from "./agent-preview";
export { ViewportToggle } from "./viewport-toggle";
export { ScaleControl } from "./scale-control";
export { DevicePresetsBar } from "./device-presets-bar";
export { PreviewUrlInput } from "./preview-url-input";

// Diff components
export { AgentDiffView, diffViewModeAtom } from "./agent-diff-view";
export type { DiffStats, AgentDiffViewRef } from "./agent-diff-view";

// Exploring group component
export { AgentExploringGroup } from "./agent-exploring-group";

// Thinking component (Extended Thinking)
export { AgentThinkingTool } from "./agent-thinking-tool";

// Message controls
export { CopyButton, PlayButton, PLAYBACK_SPEEDS } from "./message-controls";
export type { PlaybackSpeed } from "./message-controls";

// Message components
export { AssistantMessage } from "./assistant-message";
export type { AssistantMessageProps } from "./assistant-message";
export { UserMessage, CHAT_LAYOUT } from "./user-message";
export type { UserMessageProps } from "./user-message";

// Main components
export { ChatView } from "../main/active-chat";
export { NewChatForm } from "../main/new-chat-form";
