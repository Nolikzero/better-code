import { describe, expect, test } from "bun:test";
import { getProviderMcpHelp } from "./provider-mcp";

describe("getProviderMcpHelp", () => {
  test("接口服务商返回不依赖 CLI 的说明", () => {
    expect(getProviderMcpHelp("api:custom")).toEqual({
      location: "不适用",
      description: "接口服务商仅提供模型 API，不从本地 CLI 读取 MCP 配置。",
    });
  });

  test("旧服务商仍返回已有帮助信息", () => {
    expect(getProviderMcpHelp("claude").location).toContain(".claude.json");
  });
});
