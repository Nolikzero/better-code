export type ChatGoalStatus = "active" | "completed" | "blocked";

export interface ChatGoal {
  readonly title: string;
  readonly status: ChatGoalStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completionNote?: string;
  readonly blockedReason?: string;
}

function isChatGoalStatus(value: unknown): value is ChatGoalStatus {
  return value === "active" || value === "completed" || value === "blocked";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isChatGoal(value: unknown): value is ChatGoal {
  if (value === null || typeof value !== "object") return false;

  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    record.title.trim().length > 0 &&
    isChatGoalStatus(record.status) &&
    isIsoDate(record.createdAt) &&
    isIsoDate(record.updatedAt) &&
    (record.completionNote === undefined ||
      typeof record.completionNote === "string") &&
    (record.blockedReason === undefined ||
      typeof record.blockedReason === "string")
  );
}

export function parseChatGoal(
  value: string | null | undefined,
): ChatGoal | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    return isChatGoal(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
