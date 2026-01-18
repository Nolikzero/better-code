import { z } from "zod";

// GitLab pipeline job schema
export const GLPipelineJobSchema = z.object({
  name: z.string(),
  status: z.enum([
    "success",
    "failed",
    "running",
    "pending",
    "canceled",
    "skipped",
    "created",
    "manual",
  ]),
  web_url: z.string().optional(),
});

// GitLab pipeline schema (head_pipeline in MR response)
export const GLPipelineSchema = z.object({
  id: z.number(),
  status: z.enum([
    "success",
    "failed",
    "running",
    "pending",
    "canceled",
    "skipped",
    "created",
    "manual",
  ]),
  web_url: z.string(),
  jobs: z.array(GLPipelineJobSchema).optional(),
});

// GitLab MR response schema from `glab mr view --json`
export const GLMRResponseSchema = z.object({
  iid: z.number(), // Internal ID - equivalent to GitHub PR number
  title: z.string(),
  web_url: z.string(),
  state: z.enum(["opened", "closed", "merged"]),
  draft: z.boolean().optional().default(false),
  merged_at: z.string().nullable().optional(),
  // GitLab returns diff stats differently
  changes_count: z.string().optional(), // Note: GitLab may return this as string
  diff_stats: z
    .object({
      additions: z.number(),
      deletions: z.number(),
    })
    .optional(),
  // Pipeline/CI status
  head_pipeline: GLPipelineSchema.nullable().optional(),
  // Approvals
  approved: z.boolean().optional(),
  approvals_left: z.number().optional(),
});

// GitLab repo response schema from `glab repo view --json`
export const GLRepoResponseSchema = z.object({
  web_url: z.string(),
});

// GitLab CI status response from `glab ci status --json`
export const GLCIStatusSchema = z.object({
  status: z.string(),
  jobs: z.array(GLPipelineJobSchema).optional(),
});

export type GLMRResponse = z.infer<typeof GLMRResponseSchema>;
export type GLPipelineJob = z.infer<typeof GLPipelineJobSchema>;
export type GLPipeline = z.infer<typeof GLPipelineSchema>;
export type GLRepoResponse = z.infer<typeof GLRepoResponseSchema>;
