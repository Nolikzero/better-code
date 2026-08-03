import { describe, expect, test } from "bun:test";
import { mapAgentSubChats } from "./use-subchat-initialization";

describe("mapAgentSubChats", () => {
  test("preserves a persisted built-in agent selection", () => {
    const result = mapAgentSubChats(
      [
        {
          id: "subchat-1",
          name: "OMO chat",
          created_at: "2026-07-23T00:00:00.000Z",
          mode: "agent",
          agentId: "omo",
        },
      ],
      new Map(),
    );

    expect(result).toEqual([
      {
        id: "subchat-1",
        name: "OMO chat",
        created_at: "2026-07-23T00:00:00.000Z",
        updated_at: undefined,
        mode: "agent",
        providerId: undefined,
        modelId: undefined,
        agentId: "omo",
      },
    ]);
  });

  test("clears an unknown persisted built-in agent selection", () => {
    const result = mapAgentSubChats(
      [
        {
          id: "subchat-2",
          created_at: "2026-07-23T00:00:00.000Z",
          agentId: "unrecognized-agent",
        },
      ],
      new Map(),
    );

    expect(result[0]?.agentId).toBeNull();
  });
});
