import { providerRegistry } from "../providers/registry";
import type { ProviderId } from "../providers/types";
import type { RalphPrdData, UserStory } from "./index";

const PRD_GENERATION_PROMPT = `You are a JSON generator. Your ONLY task is to convert this plan into a structured PRD JSON.

CRITICAL: Output ONLY valid JSON. No explanations, no markdown fences, no tool calls. Do NOT use any tools.

## Plan:
{PLAN_TEXT}

## Feature:
{FEATURE_DESCRIPTION}

## Required JSON structure:

{
  "goal": "Overall goal description",
  "branchName": "ralph/feature-name-kebab-case",
  "stories": [
    {
      "id": "US-001",
      "title": "Short title",
      "description": "As a user, I want X so that Y",
      "type": "research",
      "priority": 1,
      "acceptanceCriteria": ["Criterion 1", "Criterion 2"],
      "passes": false
    }
  ]
}

Rules:
- "research" type: for analyze/audit/investigate/document tasks (NO "Typecheck passes" criterion)
- "implementation" type: for build/create/add/fix tasks (INCLUDE "Typecheck passes" criterion)
- Branch name: ralph/ prefix + kebab-case feature name (max 30 chars after prefix)
- Stories: 2-5 stories, incrementing priority (1, 2, 3...)
- Research stories should come before implementation stories when needed
- For UI stories, include "Verify in browser" as acceptance criterion

Output ONLY the JSON object:`;

/**
 * Generate branch name from feature description
 */
function generateBranchName(description: string): string {
  const slug = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30);
  return `ralph/${slug}`;
}

/**
 * Normalize and validate a story from parsed JSON
 */
function normalizeStory(story: any, index: number): UserStory {
  return {
    id: story.id || `US-${String(index + 1).padStart(3, "0")}`,
    title: story.title || "",
    description: story.description || "",
    type: story.type === "research" ? "research" : "implementation",
    priority: typeof story.priority === "number" ? story.priority : index + 1,
    acceptanceCriteria: Array.isArray(story.acceptanceCriteria)
      ? story.acceptanceCriteria
      : [],
    passes: false,
    notes: story.notes,
  };
}

/**
 * Compress plan text to fit within token budget.
 * Keeps structure (story titles, acceptance criteria) but removes verbose sections.
 */
function compressPlanText(planText: string, maxLength = 4000): string {
  if (planText.length <= maxLength) {
    return planText;
  }

  console.log(
    `[ralph] Plan text too long (${planText.length} chars), compressing to ~${maxLength} chars`,
  );

  const lines = planText.split("\n");
  const importantLines: string[] = [];
  let currentLength = 0;

  for (const line of lines) {
    const isImportant =
      /^#{1,4}\s/.test(line) ||
      /^\*\*US-\d+/.test(line) ||
      /^\s*-\s/.test(line) ||
      /type:\s*(research|implementation)/i.test(line) ||
      /Goal|Branch|Description|Acceptance/i.test(line) ||
      line.trim() === "";

    if (isImportant) {
      const lineLen = line.length + 1;
      if (currentLength + lineLen <= maxLength) {
        importantLines.push(line);
        currentLength += lineLen;
      }
    }
  }

  if (importantLines.length === 0) {
    const truncated = planText.slice(0, maxLength);
    const lastSentence = truncated.lastIndexOf(". ");
    return lastSentence > maxLength * 0.5
      ? truncated.slice(0, lastSentence + 1)
      : truncated;
  }

  return importantLines.join("\n");
}

/**
 * Extract JSON objects from text using balanced bracket matching.
 * Handles arbitrary nesting depth.
 */
function extractJsonObjects(text: string): string[] {
  const results: string[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] === "{") {
      let depth = 0;
      let inString = false;
      let escaped = false;
      let j = i;

      while (j < text.length) {
        const ch = text[j];

        if (escaped) {
          escaped = false;
          j++;
          continue;
        }

        if (ch === "\\") {
          escaped = true;
          j++;
          continue;
        }

        if (ch === '"') {
          inString = !inString;
        } else if (!inString) {
          if (ch === "{") depth++;
          else if (ch === "}") {
            depth--;
            if (depth === 0) {
              results.push(text.slice(i, j + 1));
              break;
            }
          }
        }
        j++;
      }
    }
    i++;
  }

  return results;
}

/**
 * Attempt to repair truncated JSON by closing open brackets/braces.
 * Used as a last resort when standard parsing fails.
 */
function repairTruncatedJson(text: string): string | null {
  let cleaned = text.replace(/,\s*$/, "");
  cleaned = cleaned.replace(/,\s*"[^"]*$/, "");
  cleaned = cleaned.replace(/:\s*"[^"]*$/, ': ""');
  cleaned = cleaned.replace(/:\s*$/, ": null");

  let braces = 0;
  let brackets = 0;
  let inString = false;
  let escaped = false;

  for (const ch of cleaned) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  while (brackets > 0) {
    cleaned += "]";
    brackets--;
  }
  while (braces > 0) {
    cleaned += "}";
    braces--;
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed.goal || parsed.stories) {
      return cleaned;
    }
  } catch {
    // Repair failed
  }

  return null;
}

/**
 * Manually extract PRD from plan text by parsing its markdown structure.
 * Used as a last-resort fallback when AI-based JSON generation fails.
 */
function extractPrdFromPlanText(
  planText: string,
  featureDescription: string,
): RalphPrdData | null {
  const stories: UserStory[] = [];

  // Extract goal from "### Goal" section or first line
  let goal = featureDescription;
  const goalMatch = planText.match(/#{1,3}\s*Goal\s*\n+([^\n#]+)/i);
  if (goalMatch) {
    goal = goalMatch[1].trim();
  }

  // Extract branch name
  let branchName = "";
  const branchMatch = planText.match(/ralph\/[a-z0-9-]+/i);
  if (branchMatch) {
    branchName = branchMatch[0];
  }

  // Parse stories: **US-001: Title** (type: research/implementation)
  const storyPattern =
    /\*\*\s*(US-\d+)\s*[:-]\s*([^*]+?)\s*\*\*\s*(?:\(type:\s*(research|implementation)\))?/gi;
  let match: RegExpExecArray | null;

  while ((match = storyPattern.exec(planText)) !== null) {
    const storyId = match[1];
    const title = match[2].trim();
    const type =
      (match[3]?.toLowerCase() as "research" | "implementation") ||
      "implementation";

    // Extract content after the story header until the next story or section
    const afterHeader = planText.slice(match.index + match[0].length);
    const nextStoryOrSection = afterHeader.search(/\*\*\s*US-\d+|^#{1,3}\s/m);
    const storyBlock =
      nextStoryOrSection > 0
        ? afterHeader.slice(0, nextStoryOrSection)
        : afterHeader.slice(0, 1000);

    // Extract description
    let description = "";
    const descMatch = storyBlock.match(/[-*]\s*Description:\s*(.+)/i);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Extract acceptance criteria
    const acceptanceCriteria: string[] = [];
    const criteriaSection = storyBlock.match(
      /Acceptance\s*Criteria:?\s*\n([\s\S]*?)(?=\n\s*\n|\n\*\*|$)/i,
    );
    if (criteriaSection) {
      const criteriaLines = criteriaSection[1].match(/^\s*[-*]\s+(.+)/gm);
      if (criteriaLines) {
        for (const line of criteriaLines) {
          const criterion = line.replace(/^\s*[-*]\s+/, "").trim();
          if (criterion) {
            acceptanceCriteria.push(criterion);
          }
        }
      }
    }

    stories.push({
      id: storyId,
      title,
      description,
      type,
      priority: stories.length + 1,
      acceptanceCriteria,
      passes: false,
    });
  }

  if (stories.length === 0) {
    return null;
  }

  console.log(
    "[ralph] Manual extraction found",
    stories.length,
    "stories from plan text",
  );

  return {
    goal,
    branchName: branchName || generateBranchName(featureDescription),
    stories,
  };
}

/**
 * Generate a structured PRD from plan text using AI
 */
export async function generatePrdFromPlan(
  planText: string,
  featureDescription: string,
  providerId: ProviderId,
  chatId: string,
  subChatId: string,
  cwd: string,
  abortController: AbortController,
): Promise<RalphPrdData> {
  const provider = providerRegistry.get(providerId);
  if (!provider) {
    throw new Error(`Provider '${providerId}' not found`);
  }

  const compressedPlan = compressPlanText(planText);
  const prompt = PRD_GENERATION_PROMPT.replace(
    "{PLAN_TEXT}",
    compressedPlan,
  ).replace("{FEATURE_DESCRIPTION}", featureDescription);

  console.log(
    "[ralph] Starting AI-powered PRD generation with provider:",
    providerId,
    "plan length:",
    compressedPlan.length,
  );

  let responseText = "";
  let toolOutputText = "";

  try {
    for await (const chunk of provider.chat({
      subChatId: `${subChatId}-prd-gen`,
      chatId,
      prompt,
      cwd,
      mode: "agent",
      abortController,
    })) {
      if (abortController.signal.aborted) {
        throw new Error("PRD generation aborted");
      }

      if (chunk.type === "text-delta") {
        responseText += chunk.delta;
      }

      // Capture ExitPlanMode tool output as fallback
      if (chunk.type === "tool-output-available") {
        const output = chunk.output as any;
        if (output?.plan) {
          toolOutputText = output.plan;
        } else if (typeof output === "string") {
          toolOutputText = output;
        }
      }

      // Capture ExitPlanMode tool input as fallback
      if (
        chunk.type === "tool-input-available" &&
        chunk.toolName === "ExitPlanMode"
      ) {
        const input = chunk.input as any;
        if (input?.plan) {
          toolOutputText = input.plan;
        }
      }
    }
  } catch (err) {
    console.error("[ralph] PRD generation stream error:", err);
    throw new Error(
      `PRD generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const fullResponse = responseText || toolOutputText;

  console.log(
    "[ralph] PRD generation response length:",
    fullResponse.length,
    "chars (text:",
    responseText.length,
    "tool:",
    toolOutputText.length,
    ")",
  );

  if (!fullResponse) {
    throw new Error("No response received from PRD generation");
  }

  // Extract JSON using balanced bracket matching
  let prdJson: any;
  const jsonCandidates = extractJsonObjects(fullResponse);

  if (jsonCandidates.length === 0) {
    // Fallback: try the raw response starting from first {
    const rawStart = fullResponse.indexOf("{");
    if (rawStart >= 0) {
      const repaired = repairTruncatedJson(fullResponse.slice(rawStart));
      if (repaired) {
        try {
          prdJson = JSON.parse(repaired);
          console.log("[ralph] JSON repair succeeded on raw response");
        } catch {
          // Fall through to error
        }
      }
    }

    if (!prdJson) {
      // Try manual extraction from plan text as fallback
      const manualPrd = extractPrdFromPlanText(planText, featureDescription);
      if (manualPrd) {
        return manualPrd;
      }
      console.error(
        "[ralph] No JSON found in response:",
        fullResponse.slice(0, 500),
      );
      throw new Error("Failed to extract JSON from PRD generation response");
    }
  }

  if (!prdJson) {
    // Try parsing candidates from last to first
    let lastError: Error | null = null;
    for (let i = jsonCandidates.length - 1; i >= 0; i--) {
      const candidate = jsonCandidates[i];
      try {
        const parsed = JSON.parse(candidate);
        if (parsed.goal || parsed.stories) {
          prdJson = parsed;
          console.log("[ralph] Found valid PRD JSON at candidate index:", i);
          break;
        }
      } catch (e) {
        lastError = e as Error;
      }
    }

    // Last resort: try to repair the longest candidate or raw response
    if (!prdJson) {
      console.log("[ralph] Attempting JSON repair...");
      const rawStart = fullResponse.indexOf("{");
      const rawCandidate = rawStart >= 0 ? fullResponse.slice(rawStart) : null;
      const longestCandidate = [...jsonCandidates].sort(
        (a, b) => b.length - a.length,
      )[0];

      for (const candidate of [rawCandidate, longestCandidate].filter(
        Boolean,
      )) {
        const repaired = repairTruncatedJson(candidate!);
        if (repaired) {
          try {
            prdJson = JSON.parse(repaired);
            console.log("[ralph] JSON repair succeeded");
            break;
          } catch {
            // Continue to next candidate
          }
        }
      }

      if (!prdJson) {
        // Final fallback: manually extract from plan text structure
        console.log(
          "[ralph] AI JSON extraction failed, trying manual extraction from plan text...",
        );
        const manualPrd = extractPrdFromPlanText(planText, featureDescription);
        if (manualPrd) {
          return manualPrd;
        }

        console.error("[ralph] JSON parse error:", lastError);
        console.error(
          "[ralph] Last JSON candidate:",
          jsonCandidates[jsonCandidates.length - 1]?.slice(0, 500),
        );
        throw new Error("Failed to parse JSON from PRD generation response");
      }
    }
  }

  // Normalize and validate the PRD
  const normalizedPrd: RalphPrdData = {
    goal: prdJson.goal || featureDescription,
    branchName: prdJson.branchName || generateBranchName(featureDescription),
    stories: Array.isArray(prdJson.stories)
      ? prdJson.stories.map((s: any, idx: number) => normalizeStory(s, idx))
      : [],
  };

  if (normalizedPrd.stories.length === 0) {
    throw new Error("PRD generation produced no stories");
  }

  console.log(
    "[ralph] PRD generated successfully:",
    normalizedPrd.goal,
    "with",
    normalizedPrd.stories.length,
    "stories",
  );

  return normalizedPrd;
}
