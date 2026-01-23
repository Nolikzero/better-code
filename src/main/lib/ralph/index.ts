import { eq } from "drizzle-orm";
import { getDatabase, ralphPrds, ralphProgress } from "../db";

// ============ TYPES ============

export type StoryType = "research" | "implementation";

export interface UserStory {
  id: string;
  title: string;
  description: string;
  priority: number;
  acceptanceCriteria: string[];
  passes: boolean;
  notes?: string;
  type?: StoryType;
}

export interface RalphPrdData {
  branchName: string;
  goal: string;
  stories: UserStory[];
}

export interface ProgressEntry {
  storyId: string | null;
  iteration: number;
  summary: string;
  learnings: string[];
}

// ============ SERVICE ============

export class RalphService {
  private db = getDatabase();

  /**
   * Get PRD for a sub-chat
   */
  getPrd(subChatId: string): RalphPrdData | null {
    const prd = this.db
      .select()
      .from(ralphPrds)
      .where(eq(ralphPrds.subChatId, subChatId))
      .get();

    if (!prd) return null;

    return {
      branchName: prd.branchName || "",
      goal: prd.goal || "",
      stories: JSON.parse(prd.stories) as UserStory[],
    };
  }

  /**
   * Get PRD database record by sub-chat ID
   */
  getPrdRecord(subChatId: string) {
    return this.db
      .select()
      .from(ralphPrds)
      .where(eq(ralphPrds.subChatId, subChatId))
      .get();
  }

  /**
   * Save or update PRD for a sub-chat
   */
  savePrd(subChatId: string, prd: RalphPrdData): void {
    const existing = this.getPrdRecord(subChatId);

    if (existing) {
      this.db
        .update(ralphPrds)
        .set({
          branchName: prd.branchName,
          goal: prd.goal,
          stories: JSON.stringify(prd.stories),
          updatedAt: new Date(),
        })
        .where(eq(ralphPrds.id, existing.id))
        .run();
    } else {
      this.db
        .insert(ralphPrds)
        .values({
          subChatId,
          branchName: prd.branchName,
          goal: prd.goal,
          stories: JSON.stringify(prd.stories),
        })
        .run();
    }
  }

  /**
   * Mark a story as complete
   * @returns true if story was marked complete, false if failed
   */
  markStoryComplete(subChatId: string, storyId: string): boolean {
    const prd = this.getPrd(subChatId);
    if (!prd) {
      console.error(
        "[ralph] markStoryComplete: No PRD found for subChatId:",
        subChatId,
      );
      return false;
    }

    const storyExists = prd.stories.some((s) => s.id === storyId);
    if (!storyExists) {
      console.error(
        "[ralph] markStoryComplete: Story not found:",
        storyId,
        "in PRD for subChatId:",
        subChatId,
      );
      return false;
    }

    const updatedStories = prd.stories.map((story) =>
      story.id === storyId ? { ...story, passes: true } : story,
    );

    this.savePrd(subChatId, { ...prd, stories: updatedStories });
    console.log("[ralph] markStoryComplete: Success for story:", storyId);
    return true;
  }

  /**
   * Mark a story as incomplete
   * @returns true if story was marked incomplete, false if failed
   */
  markStoryIncomplete(subChatId: string, storyId: string): boolean {
    const prd = this.getPrd(subChatId);
    if (!prd) {
      console.error(
        "[ralph] markStoryIncomplete: No PRD found for subChatId:",
        subChatId,
      );
      return false;
    }

    const storyExists = prd.stories.some((s) => s.id === storyId);
    if (!storyExists) {
      console.error(
        "[ralph] markStoryIncomplete: Story not found:",
        storyId,
        "in PRD for subChatId:",
        subChatId,
      );
      return false;
    }

    const updatedStories = prd.stories.map((story) =>
      story.id === storyId ? { ...story, passes: false } : story,
    );

    this.savePrd(subChatId, { ...prd, stories: updatedStories });
    console.log("[ralph] markStoryIncomplete: Success for story:", storyId);
    return true;
  }

  /**
   * Get next story to work on (highest priority with passes: false)
   */
  getNextStory(prd: RalphPrdData): UserStory | null {
    const pendingStories = prd.stories
      .filter((story) => !story.passes)
      .sort((a, b) => a.priority - b.priority);

    return pendingStories[0] || null;
  }

  /**
   * Check if all stories are complete
   */
  isComplete(prd: RalphPrdData): boolean {
    return prd.stories.length > 0 && prd.stories.every((story) => story.passes);
  }

  /**
   * Get completion stats
   */
  getStats(prd: RalphPrdData): { completed: number; total: number } {
    const completed = prd.stories.filter((story) => story.passes).length;
    return { completed, total: prd.stories.length };
  }

  /**
   * Append a progress entry
   * @returns true if progress was saved, false if failed
   */
  appendProgress(subChatId: string, entry: ProgressEntry): boolean {
    const prdRecord = this.getPrdRecord(subChatId);
    if (!prdRecord) {
      console.error(
        "[ralph] appendProgress failed: No PRD record found for subChatId:",
        subChatId,
      );
      return false;
    }

    console.log(
      "[ralph] Saving progress entry for story:",
      entry.storyId,
      "iteration:",
      entry.iteration,
    );

    try {
      this.db
        .insert(ralphProgress)
        .values({
          prdId: prdRecord.id,
          storyId: entry.storyId,
          iteration: entry.iteration,
          summary: entry.summary,
          learnings: JSON.stringify(entry.learnings),
        })
        .run();

      console.log("[ralph] Progress entry saved successfully");
      return true;
    } catch (err) {
      console.error("[ralph] appendProgress failed:", err);
      return false;
    }
  }

  /**
   * Get all progress entries for a sub-chat
   */
  getProgress(subChatId: string): ProgressEntry[] {
    const prdRecord = this.getPrdRecord(subChatId);
    if (!prdRecord) return [];

    const entries = this.db
      .select()
      .from(ralphProgress)
      .where(eq(ralphProgress.prdId, prdRecord.id))
      .orderBy(ralphProgress.timestamp)
      .all();

    return entries.map((entry) => ({
      storyId: entry.storyId, // Preserve null if null (consistent with interface)
      iteration: entry.iteration || 0,
      summary: entry.summary || "",
      learnings: entry.learnings ? JSON.parse(entry.learnings) : [],
    }));
  }

  /**
   * Get progress as text (for injecting into prompts)
   */
  getProgressText(subChatId: string): string {
    const entries = this.getProgress(subChatId);
    if (entries.length === 0) return "";

    // Build consolidated learnings section
    const allLearnings = new Set<string>();
    for (const entry of entries) {
      for (const learning of entry.learnings) {
        allLearnings.add(learning);
      }
    }

    let text = "";

    if (allLearnings.size > 0) {
      text += "## Codebase Patterns\n";
      for (const learning of allLearnings) {
        text += `- ${learning}\n`;
      }
      text += "\n";
    }

    // Add individual progress entries
    for (const entry of entries) {
      text += `## Iteration ${entry.iteration} - ${entry.storyId}\n`;
      text += `${entry.summary}\n`;
      if (entry.learnings.length > 0) {
        text += "**Learnings:**\n";
        for (const learning of entry.learnings) {
          text += `- ${learning}\n`;
        }
      }
      text += "---\n\n";
    }

    return text;
  }

  /**
   * Get current iteration number
   */
  getCurrentIteration(subChatId: string): number {
    const entries = this.getProgress(subChatId);
    if (entries.length === 0) return 1;
    return Math.max(...entries.map((e) => e.iteration)) + 1;
  }
}

// Singleton instance
let ralphServiceInstance: RalphService | null = null;

export function getRalphService(): RalphService {
  if (!ralphServiceInstance) {
    ralphServiceInstance = new RalphService();
  }
  return ralphServiceInstance;
}
