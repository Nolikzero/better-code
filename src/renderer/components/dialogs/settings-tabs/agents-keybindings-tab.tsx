import { useAtom, useAtomValue } from "jotai";
import { RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  captureKeyCombo,
  detectConflicts,
  type KeybindingCategory,
  type KeyCombo,
  keybindingOverridesAtom,
  keyComboToDisplayKeys,
  keyComboToString,
  type PlatformKeybinding,
  type ResolvedKeybinding,
  recordingKeybindingIdAtom,
  resolvedKeybindingsAtom,
} from "../../../lib/keybindings";
import {
  comboForCurrentPlatform,
  getActiveCombo,
} from "../../../lib/keybindings/matcher";

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768);
    };

    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  return isNarrow;
}

const CATEGORY_LABELS: Record<KeybindingCategory, string> = {
  general: "General",
  workspaces: "Workspaces",
  agents: "Agents",
};

const CATEGORY_ORDER: KeybindingCategory[] = [
  "general",
  "workspaces",
  "agents",
];

function ShortcutKey({ keyName }: { keyName: string }) {
  const display =
    keyName === "cmd"
      ? "\u2318"
      : keyName === "opt"
        ? "\u2325"
        : keyName === "shift"
          ? "\u21E7"
          : keyName === "ctrl"
            ? "\u2303"
            : keyName;

  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-muted bg-secondary px-1 font-[inherit] text-[11px] font-normal text-secondary-foreground">
      {display}
    </kbd>
  );
}

function KeyComboDisplay({ combo }: { combo: KeyCombo }) {
  const displayKeys = keyComboToDisplayKeys(combo);
  return (
    <div className="flex items-center gap-0.5">
      {displayKeys.map((key, i) => (
        <ShortcutKey key={i} keyName={key} />
      ))}
    </div>
  );
}

function BindingDisplay({ binding }: { binding: PlatformKeybinding }) {
  const combos = getActiveCombo(binding);
  if (combos.length === 0)
    return <span className="text-xs text-muted-foreground">None</span>;

  return (
    <div className="flex items-center gap-1.5">
      {combos.map((combo, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-xs text-muted-foreground">or</span>}
          <KeyComboDisplay combo={combo} />
        </span>
      ))}
    </div>
  );
}

interface KeyRecorderProps {
  binding: ResolvedKeybinding;
  onSave: (combo: KeyCombo) => void;
  onCancel: () => void;
}

function KeyRecorder({ binding, onSave, onCancel }: KeyRecorderProps) {
  const [captured, setCaptured] = useState<KeyCombo | null>(null);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const resolved = useAtomValue(resolvedKeybindingsAtom);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (
        e.key === "Escape" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        onCancel();
        return;
      }

      const combo = captureKeyCombo(e);
      if (!combo) return;

      setCaptured(combo);

      // Check for conflicts
      const newBinding = comboForCurrentPlatform(combo);
      const found = detectConflicts(
        newBinding,
        binding.id,
        resolved,
        binding.contexts,
      );
      setConflicts(found.map((c) => c.conflictingLabel));
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [binding, resolved, onCancel]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex flex-col gap-2 p-3 rounded-md border border-primary/50 bg-primary/5 outline-none"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {captured ? (
            <KeyComboDisplay combo={captured} />
          ) : (
            <span className="text-xs text-muted-foreground animate-pulse">
              Press a key combination...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-2 py-0.5 text-xs rounded border border-border hover:bg-foreground/5 transition-colors"
          >
            Cancel
          </button>
          {captured && (
            <button
              type="button"
              onClick={() => onSave(captured)}
              className="px-2 py-0.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Save
            </button>
          )}
        </div>
      </div>
      {conflicts.length > 0 && (
        <p className="text-xs text-yellow-500">
          Conflicts with: {conflicts.join(", ")}
        </p>
      )}
    </div>
  );
}

interface KeybindingRowProps {
  binding: ResolvedKeybinding;
  isRecording: boolean;
  onStartRecording: () => void;
  onSave: (combo: KeyCombo) => void;
  onReset: () => void;
  onCancel: () => void;
}

function KeybindingRow({
  binding,
  isRecording,
  onStartRecording,
  onSave,
  onReset,
  onCancel,
}: KeybindingRowProps) {
  if (isRecording) {
    return (
      <div className="py-1.5">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-medium text-foreground">
            {binding.label}
          </span>
        </div>
        <KeyRecorder binding={binding} onSave={onSave} onCancel={onCancel} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 group">
      <span className="text-sm text-foreground">{binding.label}</span>
      <div className="flex items-center gap-2">
        <BindingDisplay binding={binding.binding} />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={onStartRecording}
            className="px-1.5 py-0.5 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            Edit
          </button>
          {binding.isCustomized && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-border text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
              title="Reset to default"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgentsKeybindingsTab() {
  const resolved = useAtomValue(resolvedKeybindingsAtom);
  const [overrides, setOverrides] = useAtom(keybindingOverridesAtom);
  const [recordingId, setRecordingId] = useAtom(recordingKeybindingIdAtom);
  const [searchQuery, setSearchQuery] = useState("");
  const isNarrowScreen = useIsNarrowScreen();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return resolved;
    const q = searchQuery.toLowerCase();
    return resolved.filter(
      (b) =>
        b.label.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        keyComboToString(getActiveCombo(b.binding)[0] ?? { key: "" })
          .toLowerCase()
          .includes(q),
    );
  }, [resolved, searchQuery]);

  const grouped = useMemo(() => {
    const groups = new Map<KeybindingCategory, ResolvedKeybinding[]>();
    for (const category of CATEGORY_ORDER) {
      const items = filtered.filter((b) => b.category === category);
      if (items.length > 0) groups.set(category, items);
    }
    return groups;
  }, [filtered]);

  const hasOverrides = Object.keys(overrides).length > 0;

  const handleSave = useCallback(
    (bindingId: string, combo: KeyCombo) => {
      setOverrides((prev) => ({
        ...prev,
        [bindingId]: comboForCurrentPlatform(combo),
      }));
      setRecordingId(null);
    },
    [setOverrides, setRecordingId],
  );

  const handleReset = useCallback(
    (bindingId: string) => {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[bindingId];
        return next;
      });
    },
    [setOverrides],
  );

  const handleResetAll = useCallback(() => {
    setOverrides({});
  }, [setOverrides]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      {!isNarrowScreen && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              Keybindings
            </h3>
            <p className="text-xs text-muted-foreground">
              Customize keyboard shortcuts
            </p>
          </div>
          {hasOverrides && (
            <button
              type="button"
              onClick={handleResetAll}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border border-border text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              Reset All
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search keybindings..."
          className="w-full h-8 pl-8 pr-3 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* Category Sections */}
      {Array.from(grouped.entries()).map(([category, bindings]) => (
        <div
          key={category}
          className="bg-background rounded-lg border border-border overflow-hidden"
        >
          <div className="px-4 pt-3 pb-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {CATEGORY_LABELS[category]}
            </h4>
          </div>
          <div className="px-4 pb-3 divide-y divide-border/50">
            {bindings.map((binding) => (
              <KeybindingRow
                key={binding.id}
                binding={binding}
                isRecording={recordingId === binding.id}
                onStartRecording={() => setRecordingId(binding.id)}
                onSave={(combo) => handleSave(binding.id, combo)}
                onReset={() => handleReset(binding.id)}
                onCancel={() => setRecordingId(null)}
              />
            ))}
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No keybindings found matching "{searchQuery}"
        </div>
      )}
    </div>
  );
}
