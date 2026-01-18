/**
 * Format MCP tool name for display
 * Converts snake_case/underscore names to readable format
 * e.g., "get_design_context" -> "Get Design Context"
 */
export function formatToolName(toolName: string): string {
  return toolName
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\s+/g, " ")
    .trim();
}
