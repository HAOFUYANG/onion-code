import { describe, it, expect, afterAll } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { writeFileTool } from "./write_file";

const TEST_FILE = "_test_write_output.txt";
const TEST_CONTENT = "Hello, this is a test file created by write_file_tool.";

afterAll(() => {
  // 清理测试生成的文件
  try {
    fs.unlinkSync(path.resolve(process.cwd(), TEST_FILE));
  } catch {
    // 文件可能已被测试删除，忽略
  }
});

describe("writeFileTool", () => {
  it("should create a new file with given content", async () => {
    const result = await writeFileTool.invoke({
      filename: TEST_FILE,
      content: TEST_CONTENT,
    });
    expect(result).toBe(`Successfully wrote to "${TEST_FILE}".`);

    // 验证文件内容
    const written = fs.readFileSync(
      path.resolve(process.cwd(), TEST_FILE),
      "utf-8",
    );
    expect(written).toBe(TEST_CONTENT);
  });

  it("should overwrite an existing file", async () => {
    // 先写入初始内容
    fs.writeFileSync(
      path.resolve(process.cwd(), TEST_FILE),
      "initial content",
      "utf-8",
    );

    const updatedContent = "updated content";
    const result = await writeFileTool.invoke({
      filename: TEST_FILE,
      content: updatedContent,
    });
    expect(result).toBe(`Successfully wrote to "${TEST_FILE}".`);

    // 验证已被覆盖
    const written = fs.readFileSync(
      path.resolve(process.cwd(), TEST_FILE),
      "utf-8",
    );
    expect(written).toBe(updatedContent);
  });

  it("should return error for path traversal with '..'", async () => {
    const result = await writeFileTool.invoke({
      filename: "../outside.txt",
      content: "hack",
    });
    expect(result).toBe(
      "Error: Cannot write files outside the current directory.",
    );
  });

  it("should return error for nested path traversal", async () => {
    const result = await writeFileTool.invoke({
      filename: "src/../../outside.txt",
      content: "hack",
    });
    expect(result).toBe(
      "Error: Cannot write files outside the current directory.",
    );
  });

  it("should return error when target is a directory", async () => {
    const result = await writeFileTool.invoke({
      filename: "src",
      content: "content",
    });
    expect(result).toBe('Error: "src" is a directory, not a file.');
  });

  // ── 内容安全检测（防止 write→exec 绕过） ──
  it("should block content containing 'fs.rmSync'", async () => {
    const result = await writeFileTool.invoke({
      filename: "test.js",
      content:
        'const fs = require("fs"); fs.rmSync("/tmp", { recursive: true });',
    });
    expect(result).toBe(
      "Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.",
    );
  });

  it("should block content containing 'shutil.rmtree'", async () => {
    const result = await writeFileTool.invoke({
      filename: "cleanup.py",
      content: 'import shutil; shutil.rmtree("/tmp")',
    });
    expect(result).toBe(
      "Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.",
    );
  });

  it("should block content containing 'os.remove'", async () => {
    const result = await writeFileTool.invoke({
      filename: "cleanup.py",
      content: "import os; os.remove('test.txt')",
    });
    expect(result).toBe(
      "Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.",
    );
  });

  it("should block content containing 'require(\"child_process\")'", async () => {
    const result = await writeFileTool.invoke({
      filename: "run.js",
      content: 'const cp = require("child_process"); cp.execSync("ls")',
    });
    expect(result).toBe(
      "Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.",
    );
  });

  it("should block content containing 'subprocess.run'", async () => {
    const result = await writeFileTool.invoke({
      filename: "run.py",
      content: "import subprocess; subprocess.run(['ls'])",
    });
    expect(result).toBe(
      "Error: File content contains dangerous operations (e.g., fs.rmSync, shutil.rmtree) and was blocked.",
    );
  });

  it("should still allow writing normal content", async () => {
    const result = await writeFileTool.invoke({
      filename: TEST_FILE,
      content: "normal content without dangerous APIs",
    });
    expect(result).toBe(`Successfully wrote to "${TEST_FILE}".`);
  });

  it("should reject invoke with missing filename", async () => {
    await expect(
      writeFileTool.invoke({ content: "test" } as any),
    ).rejects.toThrow();
  });

  it("should reject invoke with missing content", async () => {
    await expect(
      writeFileTool.invoke({ filename: "test.txt" } as any),
    ).rejects.toThrow();
  });
});
