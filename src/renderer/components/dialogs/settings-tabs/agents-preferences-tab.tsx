import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  type CtrlTabTarget,
  ctrlTabTargetAtom,
  desktopNotificationsEnabledAtom,
  extendedThinkingEnabledAtom,
  soundNotificationsEnabledAtom,
} from "../../../lib/atoms";
import { Kbd } from "../../ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "../../ui/select";
import { Switch } from "../../ui/switch";

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

export function AgentsPreferencesTab() {
  const [thinkingEnabled, setThinkingEnabled] = useAtom(
    extendedThinkingEnabledAtom,
  );
  const [soundEnabled, setSoundEnabled] = useAtom(
    soundNotificationsEnabledAtom,
  );
  const [desktopNotificationsEnabled, setDesktopNotificationsEnabled] = useAtom(
    desktopNotificationsEnabledAtom,
  );
  const [ctrlTabTarget, setCtrlTabTarget] = useAtom(ctrlTabTargetAtom);
  const isNarrowScreen = useIsNarrowScreen();

  return (
    <div className="p-6 space-y-6">
      {/* Header - hidden on narrow screens since it's in the navigation bar */}
      {!isNarrowScreen && (
        <div className="flex flex-col space-y-1.5 text-center sm:text-left">
          <h3 className="text-sm font-semibold text-foreground">Preferences</h3>
          <p className="text-xs text-muted-foreground">
            Configure Claude's behavior and features
          </p>
        </div>
      )}

      {/* Features Section */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="p-4 space-y-6">
          {/* Extended Thinking Toggle */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground">
                Extended Thinking
              </span>
              <span className="text-xs text-muted-foreground">
                Enable deeper reasoning with more thinking tokens (uses more
                credits).{" "}
                <span className="text-foreground/70">
                  Disables response streaming.
                </span>
              </span>
            </div>
            <Switch
              checked={thinkingEnabled}
              onCheckedChange={setThinkingEnabled}
            />
          </div>

          {/* Desktop Notifications Toggle */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground">
                Desktop Notifications
              </span>
              <span className="text-xs text-muted-foreground">
                Show native notifications when agent completes work while
                you're away
              </span>
            </div>
            <Switch
              checked={desktopNotificationsEnabled}
              onCheckedChange={setDesktopNotificationsEnabled}
            />
          </div>

          {/* Sound Notifications Toggle */}
          <div className="flex items-start justify-between">
            <div className="flex flex-col space-y-1">
              <span className="text-sm font-medium text-foreground">
                Sound Notifications
              </span>
              <span className="text-xs text-muted-foreground">
                Play a sound when agent completes work while you're away
              </span>
            </div>
            <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} />
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="bg-background rounded-lg border border-border overflow-hidden">
        <div className="flex items-start justify-between p-4">
          <div className="flex flex-col space-y-1">
            <span className="text-sm font-medium text-foreground">
              Quick Switch
            </span>
            <span className="text-xs text-muted-foreground">
              What <Kbd>⌃Tab</Kbd> switches between
            </span>
          </div>

          <Select
            value={ctrlTabTarget}
            onValueChange={(value: CtrlTabTarget) => setCtrlTabTarget(value)}
          >
            <SelectTrigger className="w-auto px-2">
              <span className="text-xs">
                {ctrlTabTarget === "workspaces" ? "Workspaces" : "Agents"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspaces">Workspaces</SelectItem>
              <SelectItem value="agents">Agents</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
