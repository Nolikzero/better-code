import { describe, expect, test } from "bun:test";
import {
  BUILTIN_AGENTS,
  builtinAgentIdSchema,
  resolveBuiltinAgent,
} from "./builtin-agents";

describe("内置智能体注册表", () => {
  test("注册 OMO 智能体并提供可执行的系统提示词", () => {
    const omo = resolveBuiltinAgent("omo");

    expect(omo).not.toBeNull();
    expect(omo?.name).toBe("OMO");
    expect(omo?.systemPrompt).toContain("complete");
    expect(omo?.systemPrompt).toContain("Verify");
    expect(BUILTIN_AGENTS.map((agent) => agent.id)).toEqual(["omo"]);
  });

  test("默认或未知智能体不会注入系统提示词", () => {
    expect(resolveBuiltinAgent(null)).toBeNull();
    expect(resolveBuiltinAgent(undefined)).toBeNull();
    expect(resolveBuiltinAgent("unknown")).toBeNull();
  });

  test("边界 schema 只接受已注册智能体 ID", () => {
    expect(builtinAgentIdSchema.parse("omo")).toBe("omo");
    expect(builtinAgentIdSchema.safeParse("unknown").success).toBe(false);
  });
});
