import { useAtom, useSetAtom } from "jotai";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  Search,
  Server,
  Trash2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  normalizeProvidersList,
  type ProviderInfo,
} from "../../../features/agents/hooks/use-providers";
import {
  defaultProviderIdAtom,
  enabledProviderIdsAtom,
  lastSelectedModelByProviderAtom,
} from "../../../lib/atoms";
import { trpc } from "../../../lib/trpc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { type ApiProviderDraft, ApiProviderForm } from "./api-provider-form";

type ModelTestFeedback = {
  readonly status: "success" | "error";
  readonly modelId: string;
  readonly message: string;
  readonly latencyMs?: number;
};

function protocolLabel(provider: ProviderInfo): string {
  return provider.protocol === "openai-compatible"
    ? "OpenAI 兼容"
    : "Anthropic 兼容";
}

export function AgentsProviderTab() {
  const [defaultProvider, setDefaultProvider] = useAtom(defaultProviderIdAtom);
  const setEnabledProviderIds = useSetAtom(enabledProviderIdsAtom);
  const [modelsByProvider, setModelsByProvider] = useAtom(
    lastSelectedModelByProviderAtom,
  );
  const [editingProvider, setEditingProvider] = useState<
    ProviderInfo | undefined
  >();
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderInfo>();
  const [testingModelKey, setTestingModelKey] = useState<string>();
  const [modelSearchByProvider, setModelSearchByProvider] = useState<
    Record<string, string>
  >({});
  const [testFeedbackByProvider, setTestFeedbackByProvider] = useState<
    Record<string, ModelTestFeedback>
  >({});
  const utils = trpc.useUtils();
  const providersQuery = trpc.providers.list.useQuery();
  const providers = normalizeProvidersList(providersQuery.data);
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const selectedDefault = providers.find(
    (provider) => provider.id === defaultProvider && provider.enabled,
  );
  const defaultModels = selectedDefault?.models ?? [];
  const currentDefaultModel = selectedDefault
    ? modelsByProvider[selectedDefault.id] || defaultModels[0]?.id || ""
    : "";

  const refresh = async () => {
    await utils.providers.list.invalidate();
  };

  const applyProviderPreferences = (provider: ProviderInfo) => {
    setEnabledProviderIds((current) => {
      const withoutProvider = current.filter((id) => id !== provider.id);
      return provider.enabled
        ? [...withoutProvider, provider.id]
        : withoutProvider;
    });
    if (provider.enabled && !defaultProvider) {
      setDefaultProvider(provider.id);
    }
    if (!provider.enabled && defaultProvider === provider.id) {
      const replacement = enabledProviders.find(
        (candidate) => candidate.id !== provider.id,
      );
      setDefaultProvider(replacement?.id ?? "");
    }
    setModelsByProvider((current) => {
      const configured = current[provider.id];
      if (provider.models.some((model) => model.id === configured))
        return current;
      const firstModel = provider.models[0]?.id;
      return firstModel ? { ...current, [provider.id]: firstModel } : current;
    });
  };

  const createMutation = trpc.providers.create.useMutation({
    onSuccess: async (provider) => {
      const normalized = normalizeProvidersList([provider])[0];
      if (normalized) applyProviderPreferences(normalized);
      setShowForm(false);
      await refresh();
      toast.success("服务商已添加");
    },
  });
  const updateMutation = trpc.providers.update.useMutation({
    onSuccess: async (provider) => {
      const normalized = normalizeProvidersList([provider])[0];
      if (normalized) applyProviderPreferences(normalized);
      setEditingProvider(undefined);
      setShowForm(false);
      await refresh();
      toast.success("服务商设置已保存");
    },
  });
  const removeMutation = trpc.providers.remove.useMutation({
    onSuccess: async (_, input) => {
      setEnabledProviderIds((current) =>
        current.filter((id) => id !== input.providerId),
      );
      setModelsByProvider((current) => {
        const next = { ...current };
        delete next[input.providerId];
        return next;
      });
      if (defaultProvider === input.providerId) setDefaultProvider("");
      setDeleteTarget(undefined);
      await refresh();
      toast.success("服务商已删除");
    },
  });
  const testMutation = trpc.providers.testConnection.useMutation({
    onSuccess: (result, variables) => {
      const message = result.verified
        ? `模型可用，端点返回 ${result.models.length} 个模型`
        : "端点可达，但未返回可核对的模型列表";
      setTestFeedbackByProvider((current) => ({
        ...current,
        [variables.providerId]: {
          status: "success",
          modelId: variables.modelId,
          message,
          latencyMs: result.latencyMs,
        },
      }));
      toast.success(`模型测试成功：${variables.modelId}`);
    },
    onError: (error, variables) => {
      setTestFeedbackByProvider((current) => ({
        ...current,
        [variables.providerId]: {
          status: "error",
          modelId: variables.modelId,
          message: error.message,
        },
      }));
      toast.error("模型测试失败", { description: error.message });
    },
    onSettled: (_data, _error, variables) => {
      const modelKey = `${variables.providerId}:${variables.modelId}`;
      setTestingModelKey((current) =>
        current === modelKey ? undefined : current,
      );
    },
  });

  const handleSubmit = (draft: ApiProviderDraft) => {
    if (editingProvider) {
      updateMutation.mutate({ providerId: editingProvider.id, ...draft });
      return;
    }
    createMutation.mutate({ ...draft, apiKey: draft.apiKey });
  };

  const handleSelectModel = (provider: ProviderInfo, modelId: string) => {
    setModelsByProvider((current) => ({ ...current, [provider.id]: modelId }));
    if (provider.enabled) setDefaultProvider(provider.id);
    setTestFeedbackByProvider((current) => {
      if (!current[provider.id]) return current;
      const next = { ...current };
      delete next[provider.id];
      return next;
    });
  };

  const handleTestModel = (provider: ProviderInfo, modelId: string) => {
    const modelKey = `${provider.id}:${modelId}`;
    setTestingModelKey(modelKey);
    testMutation.mutate({ providerId: provider.id, modelId });
  };

  const handleToggle = (provider: ProviderInfo) => {
    updateMutation.mutate({
      providerId: provider.id,
      name: provider.name,
      protocol: provider.protocol,
      baseUrl: provider.baseUrl,
      apiKey: "",
      models: provider.models.map((model) => model.id),
      contextWindow: provider.contextWindow,
      enabled: !provider.enabled,
    });
  };

  const formError =
    createMutation.error?.message ?? updateMutation.error?.message;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="no-drag min-w-0 space-y-5 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            模型与服务商
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            模型和身份验证均由各服务商独立提供；应用不维护额外账户。API
            密钥仅在主进程加密保存。
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingProvider(undefined);
            setShowForm(true);
          }}
        >
          <Plus />
          添加服务商
        </Button>
      </div>

      {showForm ? (
        <div className="rounded-lg border border-border bg-background p-4">
          <h4 className="mb-4 text-sm font-medium">
            {editingProvider
              ? `编辑 ${editingProvider.name}`
              : "添加接口服务商"}
          </h4>
          <ApiProviderForm
            provider={editingProvider}
            isSaving={isSaving}
            errorMessage={formError}
            onCancel={() => {
              setShowForm(false);
              setEditingProvider(undefined);
            }}
            onSubmit={handleSubmit}
          />
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium">默认服务商</p>
                <Select
                  value={selectedDefault?.id ?? ""}
                  onValueChange={setDefaultProvider}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="尚未选择" />
                  </SelectTrigger>
                  <SelectContent>
                    {enabledProviders.map((provider) => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium">默认模型</p>
                <Select
                  value={currentDefaultModel}
                  disabled={!selectedDefault || defaultModels.length === 0}
                  onValueChange={(modelId) => {
                    if (!selectedDefault) return;
                    setModelsByProvider((current) => ({
                      ...current,
                      [selectedDefault.id]: modelId,
                    }));
                  }}
                >
                  <SelectTrigger className="h-9 w-full font-mono">
                    <SelectValue placeholder="尚未配置模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {defaultModels.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {providersQuery.isLoading && (
              <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" /> 正在读取服务商…
              </div>
            )}
            {!providersQuery.isLoading && providers.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center">
                <Server className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">尚未配置接口服务商</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  添加名称、基础 URL、API 密钥和模型列表后即可开始对话。
                </p>
              </div>
            )}
            {providers.map((provider) => {
              const selectedModelId =
                modelsByProvider[provider.id] || provider.models[0]?.id || "";
              const searchValue = modelSearchByProvider[provider.id] ?? "";
              const normalizedSearch = searchValue.trim().toLocaleLowerCase();
              const visibleModels = normalizedSearch
                ? provider.models.filter((model) =>
                    `${model.displayName} ${model.id}`
                      .toLocaleLowerCase()
                      .includes(normalizedSearch),
                  )
                : provider.models;
              const modelKey = `${provider.id}:${selectedModelId}`;
              const isTesting = testingModelKey === modelKey;
              const feedback = testFeedbackByProvider[provider.id];

              return (
                <div
                  key={provider.id}
                  className="rounded-md border border-border bg-background p-4"
                >
                  <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">
                          {provider.name}
                        </span>
                        <Badge
                          variant={provider.enabled ? "secondary" : "outline"}
                        >
                          {provider.enabled ? "已启用" : "已停用"}
                        </Badge>
                        {provider.hasApiKey && (
                          <Badge
                            variant="outline"
                            className="text-emerald-600 dark:text-emerald-400"
                          >
                            <CheckCircle2 /> 密钥已保存
                          </Badge>
                        )}
                      </div>
                      <p className="break-all font-mono text-xs text-muted-foreground">
                        {provider.baseUrl}
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        {protocolLabel(provider)} · {provider.models.length}{" "}
                        个模型 · 上下文{" "}
                        {provider.contextWindow.toLocaleString()} 个 Token
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggle(provider)}
                        disabled={isSaving}
                      >
                        {provider.enabled ? "停用" : "启用"}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`编辑 ${provider.name}`}
                        onClick={() => {
                          setEditingProvider(provider);
                          setShowForm(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label={`删除 ${provider.name}`}
                        onClick={() => setDeleteTarget(provider)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          模型列表 ({provider.models.length})
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {selectedModelId
                            ? `当前选中：${selectedModelId}`
                            : "尚未选择模型"}
                        </p>
                      </div>
                      <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={searchValue}
                          onChange={(event) =>
                            setModelSearchByProvider((current) => ({
                              ...current,
                              [provider.id]: event.target.value,
                            }))
                          }
                          placeholder="搜索模型"
                          aria-label={`搜索 ${provider.name} 的模型`}
                          className="h-9 pl-9"
                        />
                      </div>
                    </div>

                    {provider.models.length === 0 ? (
                      <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs leading-5 text-muted-foreground">
                        该服务商尚未配置模型，请先编辑服务商并添加模型。
                      </div>
                    ) : visibleModels.length === 0 ? (
                      <div className="rounded-md border border-dashed px-3 py-5 text-center text-xs text-muted-foreground">
                        没有匹配“{searchValue.trim()}”的模型
                      </div>
                    ) : (
                      <div
                        role="radiogroup"
                        aria-label={`${provider.name} 模型列表`}
                        className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2"
                      >
                        {visibleModels.map((model) => {
                          const selected = model.id === selectedModelId;
                          return (
                            <button
                              key={model.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() =>
                                handleSelectModel(provider, model.id)
                              }
                              className={`flex min-w-0 items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                selected
                                  ? "border-primary bg-primary/10 text-foreground"
                                  : "border-border bg-muted/15 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                              }`}
                            >
                              {selected ? (
                                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                              ) : (
                                <Circle className="h-4 w-4 shrink-0" />
                              )}
                              <span
                                className="min-w-0 flex-1 truncate font-mono text-sm"
                                title={model.id}
                              >
                                {model.displayName}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1" aria-live="polite">
                        {feedback && feedback.modelId === selectedModelId ? (
                          <div
                            role={
                              feedback.status === "error" ? "alert" : "status"
                            }
                            className={`flex min-w-0 items-start gap-2 rounded-md border px-3 py-2 text-xs leading-5 ${
                              feedback.status === "success"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-destructive/40 bg-destructive/10 text-destructive"
                            }`}
                          >
                            {feedback.status === "success" ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <span className="min-w-0">
                              <span className="font-mono">
                                {feedback.modelId}
                              </span>
                              ：{feedback.message}
                              {feedback.latencyMs
                                ? `（${feedback.latencyMs}ms）`
                                : ""}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs leading-5 text-muted-foreground">
                            选择一个模型后，测试会核对端点返回的模型列表并记录延迟。
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={
                          !selectedModelId ||
                          !provider.hasApiKey ||
                          testMutation.isPending
                        }
                        onClick={() =>
                          handleTestModel(provider, selectedModelId)
                        }
                      >
                        {isTesting ? (
                          <Loader2 className="animate-spin" />
                        ) : (
                          <PlugZap />
                        )}
                        {isTesting ? "正在测试…" : "测试选中模型"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(undefined);
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>删除服务商</AlertDialogTitle>
            <AlertDialogDescription>
              将删除“{deleteTarget?.name}”的地址、模型列表和已加密 API 密钥。
              此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMutation.isPending}
              onClick={() => {
                if (deleteTarget) {
                  removeMutation.mutate({ providerId: deleteTarget.id });
                }
              }}
            >
              删除服务商
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
