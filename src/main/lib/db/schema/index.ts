import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { createId } from "../utils";

// ============ PROJECTS ============
export const projects = sqliteTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  // Git remote info (extracted from local .git)
  gitRemoteUrl: text("git_remote_url"),
  gitProvider: text("git_provider"), // "github" | "gitlab" | "bitbucket" | null
  gitOwner: text("git_owner"),
  gitRepo: text("git_repo"),
  // Custom command to run after creating a worktree
  worktreeInitCommand: text("worktree_init_command"),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  chats: many(chats),
}));

// ============ CHATS ============
export const chats = sqliteTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    // Worktree fields (for git isolation per chat)
    worktreePath: text("worktree_path"),
    branch: text("branch"),
    baseBranch: text("base_branch"),
    // PR tracking fields
    prUrl: text("pr_url"),
    prNumber: integer("pr_number"),
    // AI provider (claude | codex)
    providerId: text("provider_id").default("claude"),
  },
  (table) => ({
    projectIdIdx: index("chats_project_id_idx").on(table.projectId),
    archivedAtIdx: index("chats_archived_at_idx").on(table.archivedAt),
    // Unique constraint for branch-centric model (one workspace per project+branch)
    projectBranchIdx: uniqueIndex("chats_project_branch_idx").on(
      table.projectId,
      table.branch,
    ),
  }),
);

export const chatsRelations = relations(chats, ({ one, many }) => ({
  project: one(projects, {
    fields: [chats.projectId],
    references: [projects.id],
  }),
  subChats: many(subChats),
}));

// ============ SUB-CHATS ============
export const subChats = sqliteTable(
  "sub_chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name"),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    sessionId: text("session_id"), // Claude SDK session ID for resume
    streamId: text("stream_id"), // Track in-progress streams
    mode: text("mode").notNull().default("agent"), // "plan" | "agent"
    messages: text("messages").notNull().default("[]"), // JSON array
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    // AI provider (claude | codex)
    providerId: text("provider_id").default("claude"),
    // Computed columns for performance (avoid parsing messages JSON on every query)
    hasPendingPlanApproval: integer("has_pending_plan_approval", {
      mode: "boolean",
    }).default(false),
    fileAdditions: integer("file_additions").default(0),
    fileDeletions: integer("file_deletions").default(0),
    fileCount: integer("file_count").default(0),
    // Additional working directories for context (JSON array of paths)
    addedDirs: text("added_dirs").default("[]"),
    // Emitted diff keys for deduplication across message turns (JSON array)
    emittedDiffKeys: text("emitted_diff_keys").default("[]"),
  },
  (table) => ({
    chatIdIdx: index("sub_chats_chat_id_idx").on(table.chatId),
  }),
);

export const subChatsRelations = relations(subChats, ({ one }) => ({
  chat: one(chats, {
    fields: [subChats.chatId],
    references: [chats.id],
  }),
}));

// ============ RALPH PRDs ============
export const ralphPrds = sqliteTable(
  "ralph_prds",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    branchName: text("branch_name"),
    goal: text("goal"),
    stories: text("stories").notNull().default("[]"), // JSON: UserStory[]
    createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
    updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    chatIdIdx: index("ralph_prds_chat_id_idx").on(table.chatId),
  }),
);

export const ralphPrdsRelations = relations(ralphPrds, ({ one, many }) => ({
  chat: one(chats, {
    fields: [ralphPrds.chatId],
    references: [chats.id],
  }),
  progress: many(ralphProgress),
}));

// ============ RALPH PROGRESS ============
export const ralphProgress = sqliteTable(
  "ralph_progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    prdId: text("prd_id")
      .notNull()
      .references(() => ralphPrds.id, { onDelete: "cascade" }),
    storyId: text("story_id"),
    iteration: integer("iteration"),
    summary: text("summary"),
    learnings: text("learnings"), // JSON array
    timestamp: integer("timestamp", { mode: "timestamp" }).$defaultFn(
      () => new Date(),
    ),
  },
  (table) => ({
    prdIdIdx: index("ralph_progress_prd_id_idx").on(table.prdId),
  }),
);

export const ralphProgressRelations = relations(ralphProgress, ({ one }) => ({
  prd: one(ralphPrds, {
    fields: [ralphProgress.prdId],
    references: [ralphPrds.id],
  }),
}));

// ============ CLAUDE CODE CREDENTIALS ============
// Stores encrypted OAuth token for Claude Code integration
export const claudeCodeCredentials = sqliteTable("claude_code_credentials", {
  id: text("id").primaryKey().default("default"), // Single row, always "default"
  oauthToken: text("oauth_token").notNull(), // Encrypted with safeStorage
  connectedAt: integer("connected_at", { mode: "timestamp" }).$defaultFn(
    () => new Date(),
  ),
  userId: text("user_id"), // Desktop auth user ID (for reference)
});

// ============ TYPE EXPORTS ============
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type SubChat = typeof subChats.$inferSelect;
export type NewSubChat = typeof subChats.$inferInsert;
export type ClaudeCodeCredential = typeof claudeCodeCredentials.$inferSelect;
export type NewClaudeCodeCredential = typeof claudeCodeCredentials.$inferInsert;
export type RalphPrd = typeof ralphPrds.$inferSelect;
export type NewRalphPrd = typeof ralphPrds.$inferInsert;
export type RalphProgressEntry = typeof ralphProgress.$inferSelect;
export type NewRalphProgressEntry = typeof ralphProgress.$inferInsert;
