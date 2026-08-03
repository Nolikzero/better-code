import { z } from "zod";

const grokUsageSchema = z
  .object({
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    reasoning_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
    total_cost_usd: z.number().optional(),
  })
  .passthrough();

export const grokEventSchema = z
  .object({
    type: z.string(),
    text: z.string().optional(),
    thought: z.string().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
    sessionId: z.string().optional(),
    usage: grokUsageSchema.optional(),
    input_tokens: z.number().optional(),
    output_tokens: z.number().optional(),
    reasoning_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    total_tokens: z.number().optional(),
    total_cost_usd: z.number().optional(),
  })
  .passthrough();

export type GrokEvent = z.infer<typeof grokEventSchema>;
