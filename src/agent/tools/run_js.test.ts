import { describe, it, expect } from "vitest";
import { runJsTool } from "./run_js.js";

describe("runJsTool", () => {
  // ── 正常功能 ──
  it("should execute console.log and return output", async () => {
    const result = await runJsTool.invoke({ code: 'console.log("hello")' });
    expect(result).toContain("hello");
  });

  it("should execute math calculation", async () => {
    const result = await runJsTool.invoke({ code: "console.log(1 + 2 * 3)" });
    expect(result.trim()).toBe("7");
  });

  it("should return output for multi-line code", async () => {
    const code = `
const a = 10;
const b = 20;
console.log(a + b);
`;
    const result = await runJsTool.invoke({ code });
    expect(result.trim()).toBe("30");
  });

  it("should return object output via JSON.stringify", async () => {
    const result = await runJsTool.invoke({
      code: 'console.log(JSON.stringify({name: "test", value: 42}))',
    });
    expect(result.trim()).toBe('{"name":"test","value":42}');
  });

  // ── 错误处理 ──
  it("should return syntax error for invalid JS", async () => {
    const result = await runJsTool.invoke({ code: "console.log(" });
    expect(result).toContain("Error");
    expect(result).toContain("SyntaxError");
  });

  it("should return runtime error for thrown exception", async () => {
    const result = await runJsTool.invoke({
      code: 'throw new Error("test error")',
    });
    expect(result).toContain("Error");
    expect(result).toContain("test error");
  });

  // ── 安全扫描 ──
  it("should block code with fs.rmSync", async () => {
    const result = await runJsTool.invoke({
      code: "const fs = require('fs'); fs.rmSync('/tmp')",
    });
    expect(result).toContain("blocked");
  });

  it("should block code with child_process", async () => {
    const result = await runJsTool.invoke({
      code: "const { execSync } = require('child_process'); console.log('hack')",
    });
    expect(result).toContain("blocked");
  });

  it("should block code with exec() call", async () => {
    const result = await runJsTool.invoke({
      code: 'console.log("test"); exec("rm -rf /")',
    });
    expect(result).toContain("blocked");
  });

  // ── 边界情况 ──
  it("should return error for empty code", async () => {
    const result = await runJsTool.invoke({ code: "" });
    expect(result).toBe("Error: Code cannot be empty.");
  });

  it("should return error for whitespace-only code", async () => {
    const result = await runJsTool.invoke({ code: "   " });
    expect(result).toBe("Error: Code cannot be empty.");
  });

  it("should reject invoke with missing code field", async () => {
    await expect(runJsTool.invoke({} as any)).rejects.toThrow();
  });
});
