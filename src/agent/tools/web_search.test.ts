import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted 在 vi.mock 之前执行，确保 mockInvoke 在 mock 工厂和测试体中均可访问
const mockInvoke = vi.hoisted(() => vi.fn());

vi.mock("@langchain/tavily", () => ({
  TavilySearch: class {
    invoke = mockInvoke;
    constructor(_opts: any) {
      // 模拟构造函数可能抛出的 API key 检查
      if (!process.env.TAVILY_API_KEY) {
        throw new Error("Tavily API key not found");
      }
    }
  },
}));

import { webSearchTool } from "./web_search.js";

describe("webSearchTool", () => {
  beforeEach(() => {
    process.env.TAVILY_API_KEY = "test-key";
    mockInvoke.mockReset();
  });

  // ── 正常功能 ──
  it("should return search results for a query", async () => {
    mockInvoke.mockResolvedValue(
      "San Francisco weather: 60°F, foggy. Source: weather.com",
    );

    const result = await webSearchTool.invoke({
      query: "weather in San Francisco",
    });
    expect(result).toContain("60°F");
    expect(result).toContain("foggy");
    expect(mockInvoke).toHaveBeenCalledWith({
      query: "weather in San Francisco",
    });
  });

  it("should return results for news topic", async () => {
    mockInvoke.mockResolvedValue(
      "Latest tech news: AI developments in 2026...",
    );

    const result = await webSearchTool.invoke({
      query: "latest tech news",
    });
    expect(result).toContain("tech news");
  });

  // ── 错误处理 ──
  it("should handle Tavily API errors gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await webSearchTool.invoke({
      query: "test query",
    });
    expect(result).toContain("Error");
    expect(result).toContain("API rate limit exceeded");
  });

  it("should handle network errors gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("Network error"));

    const result = await webSearchTool.invoke({
      query: "test query",
    });
    expect(result).toContain("Error");
    expect(result).toContain("Network error");
  });

  it("should handle missing API key gracefully", async () => {
    delete process.env.TAVILY_API_KEY;

    const result = await webSearchTool.invoke({ query: "test" });
    expect(result).toContain("Error");
    expect(result).toContain("Tavily API key not found");
  });

  // ── 边界情况 ──
  it("should work with empty query", async () => {
    mockInvoke.mockResolvedValue("Popular topics today...");

    const result = await webSearchTool.invoke({ query: "" });
    expect(result).toBe("Popular topics today...");
    expect(mockInvoke).toHaveBeenCalledWith({ query: "" });
  });

  it("should reject invoke with missing query field", async () => {
    await expect(webSearchTool.invoke({} as any)).rejects.toThrow();
  });
});
