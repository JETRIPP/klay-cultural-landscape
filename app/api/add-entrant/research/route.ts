import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { RECORD_ENTRANT_TOOL, RecordEntrantInput, buildNodeFromInput } from "@/lib/entrantIngest";
import type { GraphData } from "@/lib/types";

const GRAPH_PATH = path.join(process.cwd(), "data", "graph.json");

// Researches an entrant and returns a preview node - nothing is written to
// disk here. The user reviews the result and POSTs it to /confirm to
// actually add it, so a bad or hallucinated research pass never silently
// reaches the map or the eventual spreadsheet export.
export async function POST(request: NextRequest) {
  const { query } = (await request.json()) as { query?: string };
  if (!query || !query.trim()) {
    return NextResponse.json({ error: "A name or URL is required." }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const client = new Anthropic();

  let response;
  try {
    response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 8 },
        RECORD_ENTRANT_TOOL,
      ],
      messages: [
        {
          role: "user",
          content: `Research this person, studio, or organization for a cultural-landscape database entry: "${query.trim()}". Use web search to find their role/category, location (city + country), a factual 2-4 sentence bio, career highlights, up to 3 real notable works or projects (with URLs when you find them), and social/contact links (main website, secondary website if different, Instagram, Twitter/X, TikTok). Once you've gathered what you can, call record_entrant exactly once with your findings. If some fields can't be found, still call record_entrant and leave those fields null/empty rather than guessing.`,
        },
      ],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: `Research request failed: ${message}` }, { status: 502 });
  }

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === "record_entrant"
  );
  if (!toolUse) {
    return NextResponse.json({ error: "Claude did not return structured findings for this entrant." }, { status: 502 });
  }
  const input = toolUse.input as RecordEntrantInput;

  const graphRaw = await fs.readFile(GRAPH_PATH, "utf-8");
  const graph = JSON.parse(graphRaw) as GraphData;
  const usedSlugs = new Set(graph.nodes.map((n) => n.id));

  const entrant = buildNodeFromInput(input, usedSlugs);

  return NextResponse.json({ entrant });
}
