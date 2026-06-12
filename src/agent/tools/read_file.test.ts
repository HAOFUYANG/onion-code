import { describe, it, expect } from "vitest";
import { readFileTool } from "./read_file";

describe("readFileTool", () => {
  it("should read an existing file", async () => {
    const result = await readFileTool.invoke({ filename: "package.json" });
    expect(result).toContain('"name"');
  });

  it("should return error for non-existent file", async () => {
    const result = await readFileTool.invoke({
      filename: "nonexistent-file.xyz",
    });
    expect(result).toBe('Error: File "nonexistent-file.xyz" not found.');
  });

  it("should return error for directory path", async () => {
    const result = await readFileTool.invoke({ filename: "src" });
    expect(result).toBe('Error: "src" is a directory, not a file.');
  });

  it("should return error for path traversal with '..'", async () => {
    const result = await readFileTool.invoke({ filename: "../.gitignore" });
    expect(result).toBe(
      "Error: Cannot read files outside the current directory.",
    );
  });

  it("should return error for path traversal through nested '..'", async () => {
    const result = await readFileTool.invoke({
      filename: "src/../../.gitignore",
    });
    expect(result).toBe(
      "Error: Cannot read files outside the current directory.",
    );
  });

  it("should return error for empty filename (resolves to cwd, a directory)", async () => {
    const result = await readFileTool.invoke({ filename: "" });
    expect(result).toBe('Error: "" is a directory, not a file.');
  });

  it("should reject invoke with missing filename field", async () => {
    await expect(readFileTool.invoke({} as any)).rejects.toThrow();
  });
});
