import type { MCPServer, ProviderId } from "@shared/types";
import { atomWithStorage } from "jotai/utils";

// Re-export types from shared for convenience
export type { MCPServerStatus } from "@shared/types";

// ============================================
// SESSION INFO ATOMS (MCP, Plugins, Tools)
// ============================================

type SessionInfo = {
  tools: string[];
  mcpServers: MCPServer[];
  plugins: { name: string; path: string }[];
  skills: string[];
  // Track which provider this session info came from
  providerId?: ProviderId;
  // Track which subchat this session info originated from
  subChatId?: string;
};

// Session info from SDK init message
// Contains MCP servers, plugins, available tools, and skills
// Persisted to localStorage so MCP tools are visible after page refresh
// Updated when a new chat session starts
export const sessionInfoAtom = atomWithStorage<SessionInfo | null>(
  "bettercode-session-info",
  null,
  undefined,
  { getOnInit: true },
);
