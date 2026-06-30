import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

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

export const searchTool = tool(
  async ({ query }: { query: string }) => {
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
    name: "search",
    description: "Call to search the web for up-to-date information.",
    schema: z.object({
      query: z.string().describe("The query to use in your search."),
    }),
  },
);
