import { useAtomValue } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { CmdIcon } from "../../icons";
import {
  type KeybindingCategory,
  type ResolvedKeybinding,
  resolvedKeybindingsAtom,
} from "../../lib/keybindings";
import { keyComboToDisplayKeys } from "../../lib/keybindings/display";
import { getActiveCombo } from "../../lib/keybindings/matcher";

interface AgentsShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const EASING_CURVE = [0.55, 0.055, 0.675, 0.19] as const;

function ShortcutKey({ keyName }: { keyName: string }) {
  if (keyName === "cmd") {
    return (
      <kbd className="inline-flex h-5 min-w-5 min-h-5 max-h-full items-center justify-center rounded border border-muted bg-secondary px-1 font-[inherit] text-[11px] font-normal text-secondary-foreground">
        <CmdIcon className="h-2.5 w-2.5" />
      </kbd>
    );
  }

  return (
    <kbd className="inline-flex h-5 min-w-5 min-h-5 max-h-full items-center justify-center rounded border border-muted bg-secondary px-1 font-[inherit] text-[11px] font-normal text-secondary-foreground">
      {keyName === "opt"
        ? "\u2325"
        : keyName === "shift"
          ? "\u21E7"
          : keyName === "ctrl"
            ? "\u2303"
            : keyName}
    </kbd>
  );
}

function ShortcutRow({ binding }: { binding: ResolvedKeybinding }) {
  const combos = getActiveCombo(binding.binding);
  const primaryKeys = combos[0] ? keyComboToDisplayKeys(combos[0]) : [];
  const altKeys = combos[1] ? keyComboToDisplayKeys(combos[1]) : undefined;

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-foreground">{binding.label}</span>
      <div className="flex items-center gap-1">
        {primaryKeys.map((key, index) => (
          <ShortcutKey key={index} keyName={key} />
        ))}
        {altKeys && (
          <>
            <span className="text-xs text-muted-foreground mx-0.5">or</span>
            {altKeys.map((key, index) => (
              <ShortcutKey key={`alt-${index}`} keyName={key} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<KeybindingCategory, string> = {
  general: "General",
  workspaces: "Workspaces",
  agents: "Agents",
};

export function AgentsShortcutsDialog({
  isOpen,
  onClose,
}: AgentsShortcutsDialogProps) {
  const resolved = useAtomValue(resolvedKeybindingsAtom);

  const grouped = useMemo(() => {
    const categories: KeybindingCategory[] = [
      "general",
      "workspaces",
      "agents",
    ];
    const groups: Record<KeybindingCategory, ResolvedKeybinding[]> = {
      general: [],
      workspaces: [],
      agents: [],
    };

    for (const binding of resolved) {
      groups[binding.category].push(binding);
    }

    return categories
      .filter((cat) => groups[cat].length > 0)
      .map((cat) => ({ category: cat, bindings: groups[cat] }));
  }, [resolved]);

  // Handle ESC key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;

  return createPortal(
    <AnimatePresence mode="wait" initial={false}>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              transition: { duration: 0.18, ease: EASING_CURVE },
            }}
            exit={{
              opacity: 0,
              pointerEvents: "none" as const,
              transition: { duration: 0.15, ease: EASING_CURVE },
            }}
            className="fixed inset-0 z-[45] bg-black/25"
            onClick={onClose}
            style={{ pointerEvents: "auto" }}
            data-modal="agents-shortcuts"
          />

          {/* Main Dialog */}
          <div className="fixed top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] z-[46] pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2, ease: EASING_CURVE }}
              className="w-[90vw] max-w-[420px] lg:max-w-[720px] pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="bg-background rounded-xs border shadow-2xl overflow-hidden"
                data-canvas-dialog
              >
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-5 text-center">
                    Keyboard Shortcuts
                  </h2>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {/* Left column: General + Workspaces */}
                    <div className="space-y-6">
                      {grouped
                        .filter((g) => g.category !== "agents")
                        .map(({ category, bindings }) => (
                          <div key={category}>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                              {CATEGORY_LABELS[category]}
                            </h3>
                            <div className="space-y-1.5">
                              {bindings.map((binding) => (
                                <ShortcutRow
                                  key={binding.id}
                                  binding={binding}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>

                    {/* Right column: Agents */}
                    <div>
                      {grouped
                        .filter((g) => g.category === "agents")
                        .map(({ category, bindings }) => (
                          <div key={category}>
                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                              {CATEGORY_LABELS[category]}
                            </h3>
                            <div className="space-y-1.5">
                              {bindings.map((binding) => (
                                <ShortcutRow
                                  key={binding.id}
                                  binding={binding}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    portalTarget,
  );
}
