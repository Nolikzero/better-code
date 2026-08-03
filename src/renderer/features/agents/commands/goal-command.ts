export type GoalCommand =
  | { readonly type: "show" }
  | { readonly type: "set"; readonly title: string }
  | { readonly type: "complete"; readonly note?: string }
  | { readonly type: "block"; readonly reason: string }
  | { readonly type: "clear" }
  | { readonly type: "invalid"; readonly message: string };

export const goalCommandHelp =
  "用法：/goal <目标>；/goal 查看；/goal done [说明]；/goal blocked <原因>；/goal clear";

export function parseGoalCommand(input: string): GoalCommand | null {
  const match = input.trim().match(/^\/goal(?:\s+(.*))?$/iu);
  if (!match) return null;

  const argument = match[1]?.trim();
  if (!argument) return { type: "show" };
  if (argument === "clear") return { type: "clear" };

  const completionMatch = argument.match(/^done(?:\s+(.*))?$/iu);
  if (completionMatch) {
    const note = completionMatch[1]?.trim();
    return note ? { type: "complete", note } : { type: "complete" };
  }

  const blockedMatch = argument.match(/^blocked(?:\s+(.*))?$/iu);
  if (blockedMatch) {
    const reason = blockedMatch[1]?.trim();
    return reason
      ? { type: "block", reason }
      : { type: "invalid", message: "请提供受阻原因：/goal blocked <原因>" };
  }

  return { type: "set", title: argument };
}
