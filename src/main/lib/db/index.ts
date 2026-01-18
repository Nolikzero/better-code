import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { app } from "electron";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { computeAllStats } from "./computed-stats";
import * as schema from "./schema";

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

/**
 * Get the database path in the app's user data directory
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath("userData");
  const dataDir = join(userDataPath, "data");

  // Ensure data directory exists
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  return join(dataDir, "agents.db");
}

/**
 * Get the migrations folder path
 * Handles both development and production (packaged) environments
 */
function getMigrationsPath(): string {
  if (app.isPackaged) {
    // Production: migrations bundled in resources
    return join(process.resourcesPath, "migrations");
  }
  // Development: from out/main -> apps/desktop/drizzle
  return join(__dirname, "../../drizzle");
}

/**
 * Initialize the database with Drizzle ORM
 */
export function initDatabase() {
  if (db) {
    return db;
  }

  const dbPath = getDatabasePath();
  console.log(`[DB] Initializing database at: ${dbPath}`);

  // Create SQLite connection
  sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  // Create Drizzle instance
  db = drizzle(sqlite, { schema });

  // Run migrations
  const migrationsPath = getMigrationsPath();
  console.log(`[DB] Running migrations from: ${migrationsPath}`);

  try {
    migrate(db, { migrationsFolder: migrationsPath });
    console.log("[DB] Migrations completed");

    // Schedule backfill to run asynchronously after startup
    // This defers 10-100ms of work to after the window is visible
    scheduleBackfill(db);
  } catch (error) {
    console.error("[DB] Migration error:", error);
    throw error;
  }

  return db;
}

/**
 * Schedule backfill to run asynchronously after startup completes
 * This improves perceived startup time by deferring non-critical work
 */
function scheduleBackfill(database: ReturnType<typeof drizzle<typeof schema>>) {
  // Use setImmediate to defer backfill until after the current event loop
  // This allows the main window to render before backfill starts
  setImmediate(() => {
    backfillComputedColumns(database);
  });
}

/**
 * Backfill computed columns (fileAdditions, fileDeletions, fileCount, hasPendingPlanApproval)
 * for existing sub_chats that don't have these values set yet.
 * This is a one-time operation that runs after migrations.
 */
function backfillComputedColumns(
  database: ReturnType<typeof drizzle<typeof schema>>,
) {
  // Find sub-chats that need backfilling (where all computed columns are still at defaults)
  // We check if fileAdditions is null/0 AND fileCount is null/0 to identify unprocessed records
  const subChatsToBackfill = database
    .select()
    .from(schema.subChats)
    .all()
    .filter(
      (subChat) =>
        (subChat.fileAdditions === 0 || subChat.fileAdditions === null) &&
        (subChat.fileDeletions === 0 || subChat.fileDeletions === null) &&
        (subChat.fileCount === 0 || subChat.fileCount === null) &&
        (subChat.hasPendingPlanApproval === false ||
          subChat.hasPendingPlanApproval === null),
    );

  if (subChatsToBackfill.length === 0) {
    return; // Nothing to backfill
  }

  console.log(
    `[DB] Backfilling computed columns for ${subChatsToBackfill.length} sub-chats...`,
  );

  let backfilledCount = 0;
  for (const subChat of subChatsToBackfill) {
    try {
      const messages = JSON.parse(subChat.messages || "[]");
      const { fileStats, hasPendingPlanApproval } = computeAllStats(messages);

      // Only update if there's actually something to set
      if (
        fileStats.additions > 0 ||
        fileStats.deletions > 0 ||
        fileStats.fileCount > 0 ||
        hasPendingPlanApproval
      ) {
        database
          .update(schema.subChats)
          .set({
            hasPendingPlanApproval,
            fileAdditions: fileStats.additions,
            fileDeletions: fileStats.deletions,
            fileCount: fileStats.fileCount,
          })
          .where(eq(schema.subChats.id, subChat.id))
          .run();
        backfilledCount++;
      }
    } catch {
      // Skip invalid JSON
      console.warn(`[DB] Failed to backfill sub-chat ${subChat.id}`);
    }
  }

  if (backfilledCount > 0) {
    console.log(`[DB] Backfilled ${backfilledCount} sub-chats`);
  }
}

/**
 * Get the database instance
 */
export function getDatabase() {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
    console.log("[DB] Database connection closed");
  }
}

// Re-export schema for convenience
export * from "./schema";
