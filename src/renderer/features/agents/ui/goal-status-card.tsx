import type { ChatGoal } from "@shared/chat-goal";
import { CircleCheckBig, CircleDashed, CircleX, Target } from "lucide-react";

const goalStatusPresentation = {
  active: {
    label: "进行中",
    Icon: CircleDashed,
    className: "border-primary/25 bg-primary/8 text-primary",
  },
  completed: {
    label: "已完成",
    Icon: CircleCheckBig,
    className:
      "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  blocked: {
    label: "受阻",
    Icon: CircleX,
    className:
      "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
} as const;

export function GoalStatusCard({ goal }: { goal: ChatGoal }) {
  const presentation = goalStatusPresentation[goal.status];
  const StatusIcon = presentation.Icon;
  const detail =
    goal.status === "completed"
      ? goal.completionNote
      : goal.status === "blocked"
        ? goal.blockedReason
        : undefined;

  return (
    <section
      className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5 shadow-sm"
      aria-label="当前目标"
    >
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <Target className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="shrink-0">当前目标</span>
          <span className="truncate">{goal.title}</span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium ${presentation.className}`}
        >
          <StatusIcon className="size-3" aria-hidden="true" />
          {presentation.label}
        </span>
      </div>
      {detail && (
        <p className="mt-1.5 text-xs text-muted-foreground">{detail}</p>
      )}
    </section>
  );
}
