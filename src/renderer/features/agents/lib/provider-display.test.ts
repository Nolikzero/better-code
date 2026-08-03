import { describe, expect, test } from "bun:test";
import { resolveProviderDisplayName } from "./provider-display";

describe("resolveProviderDisplayName", () => {
  test("优先显示动态接口服务商名称", () => {
    expect(
      resolveProviderDisplayName("api:custom", [
        { id: "api:custom", name: "公司内部网关" },
      ]),
    ).toBe("公司内部网关");
  });

  test("保留旧服务商显示名称作为兼容回退", () => {
    expect(resolveProviderDisplayName("claude", [])).toBe("Claude Code");
  });

  test("未知服务商使用稳定的中文回退文案", () => {
    expect(resolveProviderDisplayName("api:missing", [])).toBe("未知服务商");
  });
});
