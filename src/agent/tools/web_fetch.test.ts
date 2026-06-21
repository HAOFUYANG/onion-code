import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { webFetchTool } from "./web_fetch.js";

const mockFetch = vi.fn();

describe("webFetchTool", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 正常功能 ──
  it("should fetch a URL and return text content", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve("<html><body>Hello World</body></html>"),
    });

    const result = await webFetchTool.invoke({
      url: "https://example.com",
    });
    expect(result).toContain("Hello World");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com",
      expect.any(Object),
    );
  });

  it("should fetch a Chinese web page", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: () => Promise.resolve("<html><body>面世派 官方网站</body></html>"),
    });

    const result = await webFetchTool.invoke({
      url: "https://www.mianshipai.com/",
    });
    expect(result).toContain("面世派");
  });

  // ── HTTP 错误处理 ──
  it("should handle 404 error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: () => Promise.resolve("Not Found"),
    });

    const result = await webFetchTool.invoke({
      url: "https://example.com/not-found",
    });
    expect(result).toBe("Error: HTTP 404 Not Found");
  });

  it("should handle 500 error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve("Server Error"),
    });

    const result = await webFetchTool.invoke({
      url: "https://example.com/error",
    });
    expect(result).toBe("Error: HTTP 500 Internal Server Error");
  });

  // ── 超时处理 ──
  it("should handle timeout (AbortError)", async () => {
    const abortError = new Error("The operation was aborted");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);

    const result = await webFetchTool.invoke({
      url: "https://example.com/slow",
    });
    expect(result).toContain("timed out");
  });

  // ── URL 校验 ──
  it("should block empty URL", async () => {
    const result = await webFetchTool.invoke({ url: "" });
    expect(result).toBe("Error: URL cannot be empty.");
  });

  it("should block file:// protocol", async () => {
    const result = await webFetchTool.invoke({
      url: "file:///etc/passwd",
    });
    expect(result).toContain("Only http/https URLs are supported");
  });

  it("should block ftp:// protocol", async () => {
    const result = await webFetchTool.invoke({
      url: "ftp://files.example.com/file.txt",
    });
    expect(result).toContain("Only http/https URLs are supported");
  });

  it("should block invalid URL string", async () => {
    const result = await webFetchTool.invoke({
      url: "not-a-valid-url",
    });
    expect(result).toContain("Invalid URL");
  });

  // ── DNS / 网络错误 ──
  it("should handle DNS lookup failure", async () => {
    const dnsError = new Error("getaddrinfo ENOTFOUND nonexistent.example.com");
    dnsError.code = "ENOTFOUND";
    mockFetch.mockRejectedValue(dnsError);

    const result = await webFetchTool.invoke({
      url: "https://nonexistent.example.com",
    });
    expect(result).toContain("DNS lookup failed");
  });

  it("should handle connection refused", async () => {
    const refusedError = new Error("connect ECONNREFUSED 127.0.0.1:9999");
    refusedError.code = "ECONNREFUSED";
    mockFetch.mockRejectedValue(refusedError);

    const result = await webFetchTool.invoke({
      url: "http://127.0.0.1:9999",
    });
    expect(result).toContain("Connection refused");
  });

  // ── 边界情况 ──
  it("should reject invoke with missing url field", async () => {
    await expect(webFetchTool.invoke({} as any)).rejects.toThrow();
  });
});
