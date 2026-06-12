import { describe, it, expect } from "vitest";
import { loadSkillTool } from "./load_skill";

describe("loadSkillTool", () => {
  // ── 正常加载已有 skill ──
  it("should load 'travel-guide' skill content", async () => {
    const result = await loadSkillTool.invoke({
      skillName: "travel-guide",
    });
    expect(result).toContain("# 旅行路书");
    expect(result).toContain("旅行路书规划与旅游攻略助手");
  });

  it("should load 'planner' skill content", async () => {
    const result = await loadSkillTool.invoke({
      skillName: "planner",
    });
    expect(result).toContain("# Planner");
    expect(result).toContain("帮用户创建 todo list");
  });

  // ── 不存在的 skill ──
  it("should return error for non-existent skill", async () => {
    const result = await loadSkillTool.invoke({
      skillName: "nonexistent-skill",
    });
    expect(result).toContain("Error");
    expect(result).toContain('"travel-guide"');
    expect(result).toContain('"planner"');
  });

  it("should return error for empty skill name", async () => {
    const result = await loadSkillTool.invoke({
      skillName: "",
    });
    expect(result).toContain("Error");
    expect(result).toContain('"travel-guide"');
  });

  // ── 边界情况 ──
  it("should reject invoke with missing skillName field", async () => {
    await expect(loadSkillTool.invoke({} as any)).rejects.toThrow();
  });
});
