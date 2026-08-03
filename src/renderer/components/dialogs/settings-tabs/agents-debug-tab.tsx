import { Check, Copy, FolderOpen, RefreshCw, Terminal } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { trpc } from "../../../lib/trpc";
import { Button } from "../../ui/button";

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

export function AgentsDebugTab() {
  const [copiedPath, setCopiedPath] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const isNarrowScreen = useIsNarrowScreen();

  // Fetch system info
  const { data: systemInfo, isLoading: isLoadingSystem } =
    trpc.debug.getSystemInfo.useQuery();

  // Fetch DB stats
  const {
    data: dbStats,
    isLoading: isLoadingDb,
    refetch: refetchDb,
  } = trpc.debug.getDbStats.useQuery();

  // Mutations
  const clearChatsMutation = trpc.debug.clearChats.useMutation({
    onSuccess: () => {
      toast.success("已清空所有对话");
      refetchDb();
    },
    onError: (error) => toast.error(error.message),
  });

  const clearAllDataMutation = trpc.debug.clearAllData.useMutation({
    onSuccess: () => {
      toast.success("已清空所有数据，正在重新加载…");
      setTimeout(() => window.location.reload(), 500);
    },
    onError: (error) => toast.error(error.message),
  });

  const openFolderMutation = trpc.debug.openUserDataFolder.useMutation({
    onError: (error) => toast.error(error.message),
  });

  const handleCopyPath = async () => {
    if (systemInfo?.userDataPath) {
      await navigator.clipboard.writeText(systemInfo.userDataPath);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const handleCopyDebugInfo = async () => {
    const info = {
      ...systemInfo,
      dbStats,
      timestamp: new Date().toISOString(),
    };
    await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
    setCopiedInfo(true);
    toast.success("调试信息已复制到剪贴板");
    setTimeout(() => setCopiedInfo(false), 2000);
  };

  const handleOpenDevTools = () => {
    window.desktopApi?.toggleDevTools();
  };

  const isLoading = isLoadingSystem || isLoadingDb;

  return (
    <div className="p-6 space-y-6">
      {/* Header - hidden on narrow screens since it's in the navigation bar */}
      {!isNarrowScreen && (
        <div>
          <h3 className="text-lg font-semibold mb-1">调试</h3>
          <p className="text-sm text-muted-foreground">系统信息与开发者工具</p>
        </div>
      )}

      {/* System Info */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          系统信息
        </h4>
        <div className="rounded-lg border bg-muted/30 divide-y">
          <InfoRow
            label="版本"
            value={systemInfo?.version}
            isLoading={isLoading}
          />
          <InfoRow
            label="平台"
            value={
              systemInfo
                ? `${systemInfo.platform} (${systemInfo.arch})`
                : undefined
            }
            isLoading={isLoading}
          />
          <InfoRow
            label="开发者模式"
            value={systemInfo?.isDev ? "是" : "否"}
            isLoading={isLoading}
          />
          <InfoRow
            label="协议"
            value={systemInfo?.protocolRegistered ? "已注册" : "未注册"}
            isLoading={isLoading}
            status={systemInfo?.protocolRegistered ? "success" : "warning"}
          />
          <div className="flex items-center justify-between p-3">
            <span className="text-sm text-muted-foreground">用户数据目录</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono truncate max-w-[200px]">
                {isLoading ? "..." : systemInfo?.userDataPath}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopyPath}
                disabled={!systemInfo?.userDataPath}
                aria-label="复制用户数据目录路径"
              >
                {copiedPath ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* DB Stats */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          数据库
        </h4>
        <div className="rounded-lg border bg-muted/30 divide-y">
          <InfoRow
            label="项目"
            value={dbStats?.projects?.toString()}
            isLoading={isLoading}
          />
          <InfoRow
            label="对话"
            value={dbStats?.chats?.toString()}
            isLoading={isLoading}
          />
          <InfoRow
            label="子对话"
            value={dbStats?.subChats?.toString()}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          快捷操作
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openFolderMutation.mutate()}
            disabled={openFolderMutation.isPending}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            打开用户数据目录
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenDevTools}>
            <Terminal className="h-4 w-4 mr-2" />
            开发者工具
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            重新加载
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyDebugInfo}
            disabled={isLoading}
          >
            {copiedInfo ? (
              <Check className="h-4 w-4 mr-2 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 mr-2" />
            )}
            复制信息
          </Button>
        </div>
      </div>

      {/* Toast Testing */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          消息提示测试
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.info("已发送取消请求", {
                description: "已发送给张三",
                action: {
                  label: "撤销",
                  onClick: () => toast("已撤销！"),
                },
              })
            }
          >
            信息 + 撤销
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              toast.success("成功！", { description: "操作已完成" })
            }
          >
            成功
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.error("错误", { description: "出了点问题" })}
          >
            错误
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast("默认消息", { description: "这是描述内容" })}
          >
            默认
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const id = toast.loading("正在加载…", {
                description: "请稍候",
              });
              setTimeout(() => toast.dismiss(id), 3000);
            }}
          >
            正在加载
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const id = toast.loading("正在处理…");
              setTimeout(() => {
                toast.success("完成！", { id });
              }, 2000);
            }}
          >
            异步完成
          </Button>
        </div>
      </div>

      {/* Data Management */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          数据管理
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("确定清空所有对话吗？项目会保留。")) {
                clearChatsMutation.mutate();
              }
            }}
            disabled={clearChatsMutation.isPending}
          >
            {clearChatsMutation.isPending ? "..." : "清空对话"}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (
                confirm("确定重置全部内容吗？这会清除所有本地项目和对话数据。")
              ) {
                clearAllDataMutation.mutate();
              }
            }}
            disabled={clearAllDataMutation.isPending}
          >
            {clearAllDataMutation.isPending ? "..." : "全部重置"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Helper component for info rows
function InfoRow({
  label,
  value,
  isLoading,
  status,
}: {
  label: string;
  value?: string;
  isLoading?: boolean;
  status?: "success" | "warning" | "error";
}) {
  return (
    <div className="flex items-center justify-between p-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm font-medium ${
          status === "success"
            ? "text-green-500"
            : status === "warning"
              ? "text-yellow-500"
              : status === "error"
                ? "text-red-500"
                : ""
        }`}
      >
        {isLoading ? "..." : (value ?? "-")}
      </span>
    </div>
  );
}
