import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { Button } from "../../../components/ui/button";

interface MultiSelectAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export interface MultiSelectFooterProps {
  isVisible: boolean;
  selectedCount: number;
  onCancel: () => void;
  actions: MultiSelectAction[];
  skipInitialAnimation?: boolean;
}

/**
 * Footer toolbar for multi-select mode with bulk actions.
 * Animates in/out when multi-select mode is toggled.
 */
export function MultiSelectFooter({
  isVisible,
  selectedCount,
  onCancel,
  actions,
  skipInitialAnimation = false,
}: MultiSelectFooterProps) {
  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          key="multiselect-footer"
          initial={skipInitialAnimation ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0 }}
          className="shrink-0 p-2 bg-background space-y-2"
        >
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground">
              {selectedCount} selected
            </span>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {actions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                onClick={action.onClick}
                disabled={action.disabled}
                className="flex-1 h-8 gap-1.5 text-xs rounded-lg"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
