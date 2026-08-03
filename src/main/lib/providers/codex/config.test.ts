import { describe, expect, test } from "bun:test";
import { buildCodexConfig } from "./config";

describe("Codex 内置智能体配置", () => {
  test("将内置智能体提示词作为 developer instructions 注入", () => {
    expect(buildCodexConfig("OMO prompt")).toEqual({
      developer_instructions: "OMO prompt",
    });
  });

  test("默认智能体不覆盖 Codex 配置", () => {
    expect(buildCodexConfig(undefined)).toBeUndefined();
  });
});
