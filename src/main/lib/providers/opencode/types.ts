/**
 * OpenCode Provider Types
 *
 * Type definitions unique to the OpenCode provider implementation.
 * For SDK types (events, messages, parts), import from "@opencode-ai/sdk" or "@opencode-ai/sdk/v2".
 */

// Binary discovery result
export interface OpenCodeBinaryResult {
  path: string;
  source: "bundled" | "system-path" | "system-install" | "npm-global";
}

// Server lifecycle state
export type ServerStatus =
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

export interface ServerState {
  port: number;
  pid: number;
  status: ServerStatus;
  error?: string;
}
