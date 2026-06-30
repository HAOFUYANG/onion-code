import { describe, it, expect, vi } from "vitest";

// Mock @langchain/tavily — construct mock manually
vi.mock("@langchain/tavily", () => ({
  TavilySearch: vi.fn().mockImplementation(function (this: any, _opts?: any) {
    this.invoke = vi.fn().mockResolvedValue("Mock search result");
  }),
}));

import { searchTool } from "./search.js";

describe("searchTool", () => {
  it("should return search results from Tavily", async () => {
    const result = await searchTool.invoke({ query: "test query" });
    expect(result).toBe("Mock search result");
  });

  it("should reject invoke with missing query field", async () => {
    await expect(searchTool.invoke({} as any)).rejects.toThrow();
  });
});
