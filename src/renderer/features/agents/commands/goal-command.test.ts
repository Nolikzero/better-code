import { describe, expect, test } from "bun:test";
import { parseGoalCommand } from "./goal-command";

describe("Goal slash command parser", () => {
  test("parses set and show commands", () => {
    expect(parseGoalCommand("/goal 完成模型配置")).toEqual({
      type: "set",
      title: "完成模型配置",
    });
    expect(parseGoalCommand("  /goal  ")).toEqual({ type: "show" });
  });

  test("parses completion, blocked, and clear commands", () => {
    expect(parseGoalCommand("/goal done")).toEqual({ type: "complete" });
    expect(parseGoalCommand("/goal done 已通过打包测试")).toEqual({
      type: "complete",
      note: "已通过打包测试",
    });
    expect(parseGoalCommand("/goal blocked 缺少服务商配置")).toEqual({
      type: "block",
      reason: "缺少服务商配置",
    });
    expect(parseGoalCommand("/goal clear")).toEqual({ type: "clear" });
  });

  test("rejects blocked commands without a reason", () => {
    expect(parseGoalCommand("/goal blocked")).toEqual({
      type: "invalid",
      message: "请提供受阻原因：/goal blocked <原因>",
    });
  });

  test("ignores non-goal input", () => {
    expect(parseGoalCommand("goal done")).toBeNull();
    expect(parseGoalCommand("/goals done")).toBeNull();
    expect(parseGoalCommand("/goal done extra text ")).toEqual({
      type: "complete",
      note: "extra text",
    });
  });
});
