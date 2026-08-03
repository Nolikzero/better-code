import { describe, expect, test } from "bun:test";
import { selectEnabledProviderIds } from "./provider-selection";

describe("selectEnabledProviderIds", () => {
  test("应用启动时只恢复已启用的接口服务商", () => {
    expect(
      selectEnabledProviderIds([
        { id: "api:enabled", enabled: true },
        { id: "api:disabled", enabled: false },
        { id: "claude", enabled: true },
      ]),
    ).toEqual(["api:enabled"]);
  });
});
