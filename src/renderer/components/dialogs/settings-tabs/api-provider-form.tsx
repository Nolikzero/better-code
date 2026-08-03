import type { ApiProviderProtocol } from "@shared/types";
import { Eye, EyeOff, Loader2, Plus, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ProviderInfo } from "../../../features/agents/hooks/use-providers";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Input } from "../../ui/input";
import { Label } from "../../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { Switch } from "../../ui/switch";
import { Textarea } from "../../ui/textarea";

export type ApiProviderDraft = {
  readonly name: string;
  readonly protocol: ApiProviderProtocol;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly models: string[];
  readonly contextWindow: number;
  readonly enabled: boolean;
};

type ApiProviderFormProps = {
  readonly provider?: ProviderInfo;
  readonly isSaving: boolean;
  readonly errorMessage?: string;
  readonly onCancel: () => void;
  readonly onSubmit: (draft: ApiProviderDraft) => void;
};

const DEFAULT_CONTEXT_WINDOW = 128_000;

function providerModelIds(provider?: ProviderInfo): string[] {
  return provider?.models.map((model) => model.id) ?? [];
}

function parseModels(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((model) => model.trim())
        .filter((model) => model.length > 0),
    ),
  );
}

export function ApiProviderForm({
  provider,
  isSaving,
  errorMessage,
  onCancel,
  onSubmit,
}: ApiProviderFormProps) {
  const initialModels = providerModelIds(provider);
  const [name, setName] = useState(provider?.name ?? "");
  const [protocol, setProtocol] = useState<ApiProviderProtocol>(
    provider?.protocol ?? "openai-compatible",
  );
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [availableModels, setAvailableModels] = useState(initialModels);
  const [selectedModels, setSelectedModels] = useState(initialModels);
  const [modelDraft, setModelDraft] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [contextWindow, setContextWindow] = useState(
    String(provider?.contextWindow ?? DEFAULT_CONTEXT_WINDOW),
  );
  const [enabled, setEnabled] = useState(provider?.enabled ?? true);
  const [showApiKey, setShowApiKey] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string>();

  useEffect(() => {
    const models = providerModelIds(provider);
    setName(provider?.name ?? "");
    setProtocol(provider?.protocol ?? "openai-compatible");
    setBaseUrl(provider?.baseUrl ?? "");
    setApiKey("");
    setAvailableModels(models);
    setSelectedModels(models);
    setModelDraft("");
    setModelSearch("");
    setContextWindow(String(provider?.contextWindow ?? DEFAULT_CONTEXT_WINDOW));
    setEnabled(provider?.enabled ?? true);
    setValidationMessage(undefined);
  }, [provider]);

  const filteredModels = useMemo(() => {
    const keyword = modelSearch.trim().toLocaleLowerCase();
    if (keyword.length === 0) return availableModels;
    return availableModels.filter((model) =>
      model.toLocaleLowerCase().includes(keyword),
    );
  }, [availableModels, modelSearch]);

  const addModels = () => {
    const models = parseModels(modelDraft);
    if (models.length === 0) {
      setValidationMessage("请输入至少一个模型 ID 后再加入列表。");
      return;
    }
    setAvailableModels((current) =>
      Array.from(new Set([...current, ...models])),
    );
    setSelectedModels((current) =>
      Array.from(new Set([...current, ...models])),
    );
    setModelDraft("");
    setValidationMessage(undefined);
  };

  const toggleModel = (modelId: string, checked: boolean) => {
    setSelectedModels((current) =>
      checked
        ? Array.from(new Set([...current, modelId]))
        : current.filter((model) => model !== modelId),
    );
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedContextWindow = Number(contextWindow);
    if (name.trim().length === 0) {
      setValidationMessage("请输入服务商名称。");
      return;
    }
    if (baseUrl.trim().length === 0) {
      setValidationMessage("请输入基础 URL。");
      return;
    }
    try {
      new URL(baseUrl);
    } catch (error) {
      if (error instanceof TypeError) {
        setValidationMessage("基础 URL 格式无效，请输入完整的 HTTP(S) 地址。");
        return;
      }
      throw error;
    }
    if (!provider && apiKey.trim().length === 0) {
      setValidationMessage("首次保存时必须输入 API 密钥。");
      return;
    }
    if (selectedModels.length === 0) {
      setValidationMessage("请至少选择一个模型。");
      return;
    }
    if (
      !Number.isInteger(parsedContextWindow) ||
      parsedContextWindow < 1024 ||
      parsedContextWindow > 10_000_000
    ) {
      setValidationMessage("上下文长度必须是 1,024 到 10,000,000 之间的整数。");
      return;
    }

    setValidationMessage(undefined);
    onSubmit({
      name: name.trim(),
      protocol,
      baseUrl: baseUrl.trim(),
      apiKey: apiKey.trim(),
      models: selectedModels,
      contextWindow: parsedContextWindow,
      enabled,
    });
  };

  return (
    <form className="no-drag space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="provider-name">服务商名称</Label>
          <Input
            id="provider-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：公司内部网关"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider-protocol">接口格式</Label>
          <Select
            value={protocol}
            onValueChange={(value) => {
              if (
                value === "openai-compatible" ||
                value === "anthropic-compatible"
              ) {
                setProtocol(value);
              }
            }}
          >
            <SelectTrigger id="provider-protocol" className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
              <SelectItem value="anthropic-compatible">
                Anthropic 兼容
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="provider-context-window">上下文长度</Label>
          <Input
            id="provider-context-window"
            type="number"
            min={1024}
            max={10_000_000}
            step={1}
            value={contextWindow}
            onChange={(event) => setContextWindow(event.target.value)}
          />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="provider-base-url">基础 URL</Label>
          <Input
            id="provider-base-url"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.example.com/v1"
            className="font-mono"
            autoComplete="url"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            可填写服务根地址、/v1，或完整的 chat/completions、messages 地址。
          </p>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="provider-api-key">API 密钥</Label>
          <div className="flex min-w-0 gap-2">
            <Input
              id="provider-api-key"
              type={showApiKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={
                provider?.hasApiKey
                  ? "已安全保存；留空表示不修改"
                  : "输入 API 密钥"
              }
              className="min-w-0 flex-1 font-mono"
              autoComplete="new-password"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={showApiKey ? "隐藏 API 密钥" : "显示 API 密钥"}
              onClick={() => setShowApiKey((visible) => !visible)}
            >
              {showApiKey ? <EyeOff /> : <Eye />}
            </Button>
          </div>
          {provider?.hasApiKey && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              API 密钥已由系统加密保存，不会回显到界面。
            </p>
          )}
        </div>

        <div className="space-y-3 sm:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <Label htmlFor="provider-model-draft">
                模型列表 ({availableModels.length})
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                已选择 {selectedModels.length} 个模型
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={availableModels.length === 0}
                onClick={() => setSelectedModels(availableModels)}
              >
                全选列表
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={selectedModels.length === 0}
                onClick={() => setSelectedModels([])}
              >
                清空已选
              </Button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <Textarea
                id="provider-model-draft"
                value={modelDraft}
                onChange={(event) => setModelDraft(event.target.value)}
                placeholder={
                  "粘贴模型 ID，每行一个\ngpt-5.4\nclaude-sonnet-4-5"
                }
                className="min-h-20 resize-y font-mono"
              />
            </div>
            <Button type="button" variant="outline" onClick={addModels}>
              <Plus />
              加入列表
            </Button>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={modelSearch}
              onChange={(event) => setModelSearch(event.target.value)}
              placeholder="搜索模型"
              aria-label="搜索模型"
              className="pl-9"
            />
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-muted/20 p-2">
            {availableModels.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs leading-5 text-muted-foreground">
                还没有模型。请在上方粘贴一个或多个模型 ID，并加入列表。
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                没有匹配“{modelSearch.trim()}”的模型
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredModels.map((modelId, index) => {
                  const checked = selectedModels.includes(modelId);
                  const checkboxId = `provider-model-${index}`;
                  return (
                    <label
                      key={modelId}
                      htmlFor={checkboxId}
                      className="flex min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 transition-colors hover:bg-accent/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/10"
                    >
                      <Checkbox
                        id={checkboxId}
                        checked={checked}
                        onCheckedChange={(value) =>
                          toggleModel(modelId, value === true)
                        }
                        aria-label={`选择模型 ${modelId}`}
                      />
                      <span
                        className="min-w-0 truncate font-mono text-sm"
                        title={modelId}
                      >
                        {modelId}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            保存时只写入已勾选模型；未勾选项不会出现在对话模型选择器中。
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-muted/30 p-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">启用服务商</p>
          <p className="text-xs leading-5 text-muted-foreground">
            启用后会出现在新对话和模型选择器中。
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {(validationMessage || errorMessage) && (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {validationMessage ?? errorMessage}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          {provider ? "保存修改" : "添加服务商"}
        </Button>
      </div>
    </form>
  );
}
