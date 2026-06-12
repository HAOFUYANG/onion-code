import { describe, it, expect, vi } from "vitest";
import { searchTool } from "./search";

describe("searchTool", () => {
  it("should return foggy weather when query contains 'sf'", async () => {
    const result = await searchTool.invoke({ query: "weather in SF" });
    expect(result).toBe("It's 60 degrees and foggy.");
  });

  it("should return foggy weather when query contains 'san francisco'", async () => {
    const result = await searchTool.invoke({ query: "San Francisco weather" });
    expect(result).toBe("It's 60 degrees and foggy.");
  });

  it("should return foggy weather when query is only 'sf'", async () => {
    const result = await searchTool.invoke({ query: "sf" });
    expect(result).toBe("It's 60 degrees and foggy.");
  });

  it("should return sunny weather for queries not mentioning SF", async () => {
    const result = await searchTool.invoke({ query: "weather in New York" });
    expect(result).toBe("It's 90 degrees and sunny.");
  });

  it("should return sunny weather for empty query", async () => {
    const result = await searchTool.invoke({ query: "" });
    expect(result).toBe("It's 90 degrees and sunny.");
  });

  it("should reject invoke with missing query field", async () => {
    await expect(searchTool.invoke({} as any)).rejects.toThrow();
  });
});
