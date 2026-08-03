/**
 * OpenCode Provider Types
 *
 * Type definitions unique to the OpenCode provider implementation.
 * For SDK types (events, messages, parts), import from "@opencode-ai/sdk" or "@opencode-ai/sdk/v2".
 */

import type { CliBinaryResult } from "../cli-runtime";

// Binary discovery result
export type OpenCodeBinaryResult = CliBinaryResult;

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
