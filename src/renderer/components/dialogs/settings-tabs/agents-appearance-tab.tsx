import { useAtom } from "jotai";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../../components/ui/select";
import {
  selectedFullThemeIdAtom,
  type VSCodeFullTheme,
} from "../../../lib/atoms";
import {
  ALUCARD_THEME_ID,
  BUILTIN_THEMES,
  DRACULA_THEME_ID,
  getBuiltinThemeById,
  resolveBuiltinThemeId,
} from "../../../lib/themes/builtin-themes";
import { cn } from "../../../lib/utils";

const PALETTE_KEYS = [
  "editor.background",
  "button.background",
  "textLink.foreground",
  "terminal.ansiGreen",
  "terminal.ansiYellow",
  "errorForeground",
] as const;

function ThemePreviewBox({
  theme,
  compact = false,
}: {
  theme: VSCodeFullTheme;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center overflow-hidden rounded-sm border",
        compact ? "h-6 w-9" : "h-9 w-14",
      )}
      style={{
        backgroundColor: theme.colors["editor.background"],
        borderColor: theme.colors["sideBar.border"],
      }}
      aria-hidden="true"
    >
      <span
        className="h-full w-[38%]"
        style={{ backgroundColor: theme.colors["sideBar.background"] }}
      />
      <span
        className="mx-auto block rounded-full"
        style={{
          width: compact ? 7 : 10,
          height: compact ? 7 : 10,
          backgroundColor: theme.colors["button.background"],
        }}
      />
    </div>
  );
}

function PaletteStrip({ theme }: { theme: VSCodeFullTheme }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${theme.name} 色板`}>
      {PALETTE_KEYS.map((key) => (
        <span
          key={key}
          className="h-3.5 w-3.5 rounded-[3px] border border-foreground/10"
          style={{ backgroundColor: theme.colors[key] }}
        />
      ))}
    </div>
  );
}

function SystemThemeCard({
  label,
  theme,
}: {
  label: string;
  theme: VSCodeFullTheme;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-md border border-border/80 bg-card/70 p-3 shadow-sm">
      <ThemePreviewBox theme={theme} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <PaletteStrip theme={theme} />
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {theme.name}
        </p>
      </div>
    </div>
  );
}

export function AgentsAppearanceTab() {
  const shouldReduceMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();
  const [selectedThemeId, setSelectedThemeId] = useAtom(
    selectedFullThemeIdAtom,
  );

  const alucard = getBuiltinThemeById(ALUCARD_THEME_ID);
  const dracula = getBuiltinThemeById(DRACULA_THEME_ID);
  if (!alucard || !dracula) {
    throw new Error("内置应用主题不可用");
  }

  const normalizedSelectedThemeId = useMemo(
    () =>
      selectedThemeId === null
        ? null
        : resolveBuiltinThemeId(
            selectedThemeId,
            resolvedTheme === "light" ? "light" : "dark",
          ),
    [resolvedTheme, selectedThemeId],
  );

  const currentTheme =
    normalizedSelectedThemeId === null
      ? resolvedTheme === "light"
        ? alucard
        : dracula
      : (getBuiltinThemeById(normalizedSelectedThemeId) ?? dracula);
  const isSystemMode = normalizedSelectedThemeId === null;

  return (
    <div className="max-h-[70vh] space-y-5 overflow-y-auto p-6">
      <div className="hidden flex-col space-y-1.5 text-left md:flex">
        <h3 className="text-sm font-semibold text-foreground">外观</h3>
        <p className="text-xs text-muted-foreground">
          使用 Dracula 与 Alucard 统一应用、代码和终端配色
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-card-foreground">
              界面主题
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              跟随系统会在浅色 Alucard 与深色 Dracula 之间自动切换。
            </p>
          </div>

          <Select
            value={normalizedSelectedThemeId ?? "system"}
            onValueChange={(value) => {
              setSelectedThemeId(value === "system" ? null : value);
            }}
          >
            <SelectTrigger className="w-full min-w-0 bg-input-background px-2.5 sm:w-[190px]">
              <div className="flex min-w-0 items-center gap-2.5">
                <ThemePreviewBox theme={currentTheme} compact />
                <span className="truncate text-xs">
                  {isSystemMode ? "跟随系统" : currentTheme.name}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">
                <div className="flex items-center gap-2.5">
                  <ThemePreviewBox theme={currentTheme} compact />
                  <span>跟随系统</span>
                </div>
              </SelectItem>
              {BUILTIN_THEMES.map((theme) => (
                <SelectItem key={theme.id} value={theme.id}>
                  <div className="flex items-center gap-2.5">
                    <ThemePreviewBox theme={theme} compact />
                    <span>{theme.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AnimatePresence initial={false}>
          {isSystemMode && (
            <motion.div
              initial={shouldReduceMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { duration: 0.18, ease: "easeOut" }
              }
              className="overflow-hidden border-t border-border"
            >
              <div className="grid gap-3 bg-muted/35 p-4 sm:grid-cols-2">
                <SystemThemeCard label="浅色外观" theme={alucard} />
                <SystemThemeCard label="深色外观" theme={dracula} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h4 className="text-sm font-medium text-card-foreground">
              当前色板
            </h4>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              编辑器、终端、差异视图与交互状态共享同一套语义颜色。
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border bg-background/70 px-3 py-2">
            <PaletteStrip theme={currentTheme} />
            <span className="text-xs font-medium text-foreground">
              {currentTheme.name}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
