import { tool } from "@langchain/core/tools";
import { z } from "zod";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_SIZE = 1024 * 512; // 512KB
const MAX_REDIRECTS = 5;

function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // 只允许 http / https 协议
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export const webFetchTool = tool(
  async ({ url }: { url: string }) => {
    if (!url.trim()) {
      return "Error: URL cannot be empty.";
    }

    if (!isValidUrl(url)) {
      return `Error: Invalid URL "${url}". Only http/https URLs are supported.`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      // 手动处理重定向以限制次数
      let response: Response;
      let redirectCount = 0;
      {
        let currentUrl: string | URL = url;
        while (true) {
          response = await fetch(currentUrl, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; OnionCode/1.0; +https://github.com/onioncode)",
            },
            redirect: "manual",
          });

          // 3xx 状态码且带 Location 头时手动重定向
          if (
            response.status >= 300 &&
            response.status < 400 &&
            response.headers.has("location")
          ) {
            if (redirectCount >= MAX_REDIRECTS) {
              return `Error: Too many redirects (max ${MAX_REDIRECTS}).`;
            }
            // 解析相对 URL
            const location = response.headers.get("location")!;
            currentUrl = new URL(location, currentUrl).toString();
            response.body?.cancel(); // Node.js 17.3+ 支持
            redirectCount++;
            continue;
          }
          break;
        }
      }

      if (!response.ok) {
        return `Error: HTTP ${response.status} ${response.statusText}`;
      }

      const text = await response.text();

      if (text.length > MAX_RESPONSE_SIZE) {
        return `Error: Response too large (${(text.length / 1024).toFixed(1)}KB). Maximum allowed is ${MAX_RESPONSE_SIZE / 1024}KB.`;
      }

      return text;
    } catch (err: any) {
      if (err.name === "AbortError") {
        return `Error: Request timed out after ${FETCH_TIMEOUT_MS / 1000} seconds.`;
      }
      if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
        return `Error: DNS lookup failed for "${url}". The domain may not exist or the network is unavailable.`;
      }
      if (err.code === "ECONNREFUSED") {
        return `Error: Connection refused for "${url}".`;
      }
      if (err.code === "ECONNRESET") {
        return `Error: Connection reset while fetching "${url}".`;
      }
      return `Error: ${err.message}`;
    } finally {
      clearTimeout(timeoutId);
    }
  },
  {
    name: "web_fetch",
    description:
      "Fetch and return the content of a web page given a URL. Only http/https URLs are allowed. Use this to download web pages, read API responses, or access online resources.",
    schema: z.object({
      url: z.string().describe("The URL to fetch."),
    }),
  },
);
