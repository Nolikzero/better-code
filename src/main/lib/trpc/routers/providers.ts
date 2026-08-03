import { API_PROVIDER_PROTOCOLS, type ProviderId } from "@shared/types";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { ApiProvider } from "../../providers/api/provider";
import {
  createApiProvider,
  deleteApiProvider,
  getApiProviderRecord,
  getApiProviderSettings,
  listApiProviderSettings,
  updateApiProvider,
} from "../../providers/api/store";
import {
  getEnabledProviders,
  reloadProvider,
  removeProvider,
  setEnabledProviders,
} from "../../providers/init";
import { publicProcedure, router } from "../index";

const providerIdSchema = z
  .string()
  .trim()
  .min(5)
  .max(80)
  .regex(/^api:[0-9a-f-]+$/i, "服务商 ID 格式无效");

const providerFieldsSchema = z.object({
  name: z.string().trim().min(1, "请输入服务商名称").max(80),
  protocol: z.enum(API_PROVIDER_PROTOCOLS),
  baseUrl: z.url("请输入有效的接口地址").max(2048),
  apiKey: z.string().trim().max(4096).optional(),
  models: z
    .array(z.string().trim().min(1).max(200))
    .max(200)
    .transform((models) => Array.from(new Set(models))),
  contextWindow: z.number().int().min(1024).max(10_000_000),
  enabled: z.boolean(),
});

function toFlatStatus(
  settings: ReturnType<typeof listApiProviderSettings>[number],
) {
  return {
    ...settings,
    description:
      settings.protocol === "openai-compatible"
        ? "OpenAI 兼容接口"
        : "Anthropic 兼容接口",
    available: settings.hasApiKey && settings.baseUrl.length > 0,
    authStatus: settings.hasApiKey
      ? ({ authenticated: true, method: "api-key" } as const)
      : ({ authenticated: false, error: "尚未配置 API Key" } as const),
  };
}

type LegacyOpenCodeProvider = {
  readonly id: string;
  readonly name: string;
  readonly connected: boolean;
  readonly models: readonly {
    readonly id: string;
    readonly name: string;
    readonly displayName: string;
  }[];
};

export const providersRouter = router({
  getEnabled: publicProcedure.query((): ProviderId[] => {
    return getEnabledProviders();
  }),

  setEnabled: publicProcedure
    .input(z.object({ providerIds: z.array(providerIdSchema) }))
    .mutation(async ({ input }): Promise<ProviderId[]> => {
      await setEnabledProviders(input.providerIds);
      return getEnabledProviders();
    }),

  list: publicProcedure.query(() => {
    return listApiProviderSettings().map(toFlatStatus);
  }),

  create: publicProcedure
    .input(
      providerFieldsSchema.extend({
        apiKey: z.string().trim().min(1).max(4096),
      }),
    )
    .mutation(async ({ input }) => {
      const settings = createApiProvider(input);
      if (settings.enabled) {
        await setEnabledProviders([...getEnabledProviders(), settings.id]);
      }
      return toFlatStatus(settings);
    }),

  update: publicProcedure
    .input(providerFieldsSchema.extend({ providerId: providerIdSchema }))
    .mutation(async ({ input }) => {
      const updated = updateApiProvider(input.providerId, input);
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到服务商" });
      }

      if (updated.enabled) {
        const nextEnabled = Array.from(
          new Set([...getEnabledProviders(), updated.id]),
        );
        await setEnabledProviders(nextEnabled);
        await reloadProvider(updated.id);
      } else {
        await setEnabledProviders(
          getEnabledProviders().filter((id) => id !== updated.id),
        );
      }
      return toFlatStatus(updated);
    }),

  remove: publicProcedure
    .input(z.object({ providerId: providerIdSchema }))
    .mutation(async ({ input }) => {
      await removeProvider(input.providerId);
      return { removed: deleteApiProvider(input.providerId) };
    }),

  getStatus: publicProcedure
    .input(z.object({ providerId: providerIdSchema }))
    .query(({ input }) => {
      const settings = getApiProviderSettings(input.providerId);
      return settings ? toFlatStatus(settings) : null;
    }),

  isReady: publicProcedure
    .input(z.object({ providerId: providerIdSchema }))
    .query(({ input }) => {
      const settings = getApiProviderSettings(input.providerId);
      if (!settings) return { ready: false, reason: "未找到服务商" };
      if (!settings.hasApiKey) {
        return { ready: false, reason: "尚未配置 API Key" };
      }
      if (settings.models.length === 0) {
        return { ready: false, reason: "尚未配置模型列表" };
      }
      return { ready: true };
    }),

  getModels: publicProcedure
    .input(z.object({ providerId: providerIdSchema }))
    .query(({ input }) => {
      return getApiProviderSettings(input.providerId)?.models ?? [];
    }),

  testConnection: publicProcedure
    .input(
      z.object({
        providerId: providerIdSchema,
        modelId: z.string().trim().min(1).max(200),
      }),
    )
    .mutation(async ({ input }) => {
      const record = getApiProviderRecord(input.providerId);
      if (!record) {
        throw new TRPCError({ code: "NOT_FOUND", message: "未找到服务商" });
      }
      const result = await new ApiProvider(record).testModel(input.modelId);
      return { ok: true, ...result };
    }),

  getOpenCodeProviders: publicProcedure.query(
    (): { readonly providers: readonly LegacyOpenCodeProvider[] } => ({
      providers: [],
    }),
  ),
});
