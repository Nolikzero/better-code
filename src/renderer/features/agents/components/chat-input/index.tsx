// Chat Input Compound Components
// Usage:
// <ChatInputRoot ...>
//   <ChatInputEditor ... />
//   <ChatInputActions ... />
// </ChatInputRoot>

export {
  ChatInputContext,
  useChatInputContext,
  type ImageAttachment,
  type FileAttachment,
  type ChatInputContextValue,
} from "./chat-input-context";

export { ChatInputRoot, type ChatInputRootProps } from "./chat-input-root";

export {
  ChatInputAttachments,
  type ChatInputAttachmentsProps,
} from "./chat-input-attachments";

export {
  ChatInputEditor,
  type ChatInputEditorProps,
} from "./chat-input-editor";

export {
  ChatInputActions,
  type ChatInputActionsProps,
} from "./chat-input-actions";
