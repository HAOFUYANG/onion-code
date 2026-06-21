import { describe, it, expect } from "vitest";
import { execTool } from "./exec.js";
import * as path from "node:path";

describe("execTool", () => {
  // ── 正常功能 ──
  it("should execute 'echo' and return the output", async () => {
    const result = await execTool.invoke({ command: "echo hello world" });
    expect(result).toContain("hello world");
  });

  it("should execute 'pwd' and return current directory", async () => {
    const result = await execTool.invoke({ command: "pwd" });
    expect(result.trim()).toBe(process.cwd());
  });

  it("should list files with 'ls'", async () => {
    const result = await execTool.invoke({ command: "ls" });
    expect(result).toContain("package.json");
    expect(result).toContain("src");
  });

  // ── 第 1 层：危险命令名测试 ──
  it("should block 'rm' command", async () => {
    const result = await execTool.invoke({ command: "rm test.txt" });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block 'sudo' command", async () => {
    const result = await execTool.invoke({ command: "sudo ls" });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block 'chmod' command", async () => {
    const result = await execTool.invoke({ command: "chmod 777 file" });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block 'mv' command", async () => {
    const result = await execTool.invoke({ command: "mv old new" });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block 'cp' command", async () => {
    const result = await execTool.invoke({ command: "cp a b" });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  // ── 第 2 层：Eval 模式注入检测 ──
  it("should block 'node -e' eval injection", async () => {
    const result = await execTool.invoke({
      command: "node -e \"require('fs').rmSync('test')\"",
    });
    expect(result).toBe(
      "Error: Eval-style commands (node -e, python -c, etc.) are blocked for security.",
    );
  });

  it("should block 'node --eval' eval injection", async () => {
    const result = await execTool.invoke({
      command: 'node --eval "console.log(1)"',
    });
    expect(result).toBe(
      "Error: Eval-style commands (node -e, python -c, etc.) are blocked for security.",
    );
  });

  it("should block 'node -p' print eval", async () => {
    const result = await execTool.invoke({
      command: 'node -p "1+1"',
    });
    expect(result).toBe(
      "Error: Eval-style commands (node -e, python -c, etc.) are blocked for security.",
    );
  });

  it("should block 'python -c' eval injection", async () => {
    const result = await execTool.invoke({
      command: "python -c \"import os\nos.remove('test')\"",
    });
    expect(result).toBe(
      "Error: Eval-style commands (node -e, python -c, etc.) are blocked for security.",
    );
  });

  // ── 第 3 层：危险 API 调用检测 ──
  it("should block command containing 'fs.rmSync' API call", async () => {
    const result = await execTool.invoke({
      command: 'some_script.js fs.rmSync("/tmp")',
    });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block command containing 'shutil.rmtree' API call", async () => {
    const result = await execTool.invoke({
      command: "script.py -c \"import shutil; shutil.rmtree('/tmp')\"",
    });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block command containing 'require(\"fs\")' pattern", async () => {
    const result = await execTool.invoke({
      command: 'node index.js require("fs")',
    });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  it("should block command containing 'child_process' reference", async () => {
    const result = await execTool.invoke({
      command: "script.js --eval \"child_process.execSync('ls')\"",
    });
    expect(result).toBe(
      "Error: Command contains dangerous operations and was blocked.",
    );
  });

  // ── 边界情况 ──
  it("should return error for empty command", async () => {
    const result = await execTool.invoke({ command: "" });
    expect(result).toBe("Error: Command cannot be empty.");
  });

  it("should return error for non-existent command", async () => {
    const result = await execTool.invoke({
      command: "nonexistent_command_xyz",
    });
    expect(result).toContain("Error");
  });

  it("should reject invoke with missing command field", async () => {
    await expect(execTool.invoke({} as any)).rejects.toThrow();
  });
});
