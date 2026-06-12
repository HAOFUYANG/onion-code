import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";
import { toolLog } from "../style";

function getTavilyClient(): TavilySearch | null {
  try {
    return new TavilySearch({
      maxResults: 3,
      topic: "general",
    });
  } catch {
    return null;
  }
}

export const webSearchTool = tool(
  async ({ query }: { query: string }) => {
    console.log(toolLog("web_search", query));

    const client = getTavilyClient();
    if (!client) {
      return "Error: Tavily API key not found. Please set TAVILY_API_KEY environment variable.";
    }

    try {
      const result = await client.invoke({ query });
      return result;
    } catch (err: any) {
      return `Error: ${err.message}`;
    }
  },
  {
    name: "web_search",
    description:
      "Search the web for up-to-date information using Tavily search engine. Use this instead of search tool for real-time web results.",
    schema: z.object({
      query: z.string().describe("The search query."),
    }),
  },
);
