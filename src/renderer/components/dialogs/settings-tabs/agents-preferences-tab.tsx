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
          <h3 className="text-sm font-semibold text-foreground">偏好设置</h3>
          <p className="text-xs text-muted-foreground">
            配置智能体的行为与功能
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
                扩展思考
              </span>
              <span className="text-xs text-muted-foreground">
                使用更多思考 Token 启用深度推理（会消耗更多额度），并
                <span className="text-foreground/70">禁用响应流式传输。</span>
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
                桌面通知
              </span>
              <span className="text-xs text-muted-foreground">
                离开时智能体完成工作后显示系统通知
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
                声音通知
              </span>
              <span className="text-xs text-muted-foreground">
                离开时智能体完成工作后播放提示音
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
              快速切换
            </span>
            <span className="text-xs text-muted-foreground">
              设置 <Kbd>⌃Tab</Kbd> 的切换对象
            </span>
          </div>

          <Select
            value={ctrlTabTarget}
            onValueChange={(value: CtrlTabTarget) => setCtrlTabTarget(value)}
          >
            <SelectTrigger className="w-auto px-2">
              <span className="text-xs">
                {ctrlTabTarget === "workspaces" ? "工作区" : "智能体"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="workspaces">工作区</SelectItem>
              <SelectItem value="agents">智能体</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
