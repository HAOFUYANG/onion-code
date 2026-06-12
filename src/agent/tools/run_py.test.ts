import { describe, it, expect } from "vitest";
import { runPyTool } from "./run_py";

describe("runPyTool", () => {
  // ── 正常功能 ──
  it("should execute print() and return output", async () => {
    const result = await runPyTool.invoke({ code: 'print("hello")' });
    expect(result).toContain("hello");
  });

  it("should execute math calculation", async () => {
    const result = await runPyTool.invoke({ code: "print(1 + 2 * 3)" });
    expect(result.trim()).toBe("7");
  });

  it("should return output for multi-line code", async () => {
    const code = `
a = 10
b = 20
print(a + b)
`;
    const result = await runPyTool.invoke({ code });
    expect(result.trim()).toBe("30");
  });

  it("should return dict output", async () => {
    const result = await runPyTool.invoke({
      code: 'import json; print(json.dumps({"name": "test", "value": 42}))',
    });
    expect(result.trim()).toBe('{"name": "test", "value": 42}');
  });

  // ── 错误处理 ──
  it("should return syntax error for invalid Python", async () => {
    const result = await runPyTool.invoke({ code: "print(" });
    expect(result).toContain("Error");
    expect(result).toContain("SyntaxError");
  });

  it("should return runtime error for raised exception", async () => {
    const result = await runPyTool.invoke({
      code: 'raise Exception("test error")',
    });
    expect(result).toContain("Error");
    expect(result).toContain("test error");
  });

  // ── 安全扫描 ──
  it("should block code with os.remove", async () => {
    const result = await runPyTool.invoke({
      code: "import os; os.remove('/tmp/test')",
    });
    expect(result).toContain("blocked");
  });

  it("should block code with subprocess", async () => {
    const result = await runPyTool.invoke({
      code: "import subprocess; subprocess.run(['ls'])",
    });
    expect(result).toContain("blocked");
  });

  it("should block code with shutil.rmtree", async () => {
    const result = await runPyTool.invoke({
      code: "import shutil; shutil.rmtree('/tmp')",
    });
    expect(result).toContain("blocked");
  });

  // ── 边界情况 ──
  it("should return error for empty code", async () => {
    const result = await runPyTool.invoke({ code: "" });
    expect(result).toBe("Error: Code cannot be empty.");
  });

  it("should return error for whitespace-only code", async () => {
    const result = await runPyTool.invoke({ code: "   " });
    expect(result).toBe("Error: Code cannot be empty.");
  });

  it("should reject invoke with missing code field", async () => {
    await expect(runPyTool.invoke({} as any)).rejects.toThrow();
  });
});
