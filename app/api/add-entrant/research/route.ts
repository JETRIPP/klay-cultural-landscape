import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { RECORD_ENTRANT_TOOL, RecordEntrantInput, baseSlug, buildNodeFromInput } from "@/lib/entrantIngest";
import { getEntrantNameById, getUsedSlugs } from "@/lib/db";

// Without this, the route falls back to the platform's default serverless
// timeout (well under a minute), which a multi-round web-search research
// call can easily exceed - the function gets killed mid-request with no
// clean error, which reads to the client as an indefinite hang rather than
// a fast failure.
export const maxDuration = 120;

// Researches an entrant and returns a preview node - nothing is written to
// the database here. The user reviews the result and POSTs it to /confirm to
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

  // Temporary instrumentation to find the actual bottleneck (raw model
  // latency vs. number of search rounds vs. something else) instead of
  // guessing further - safe to remove once the cause is confirmed.
  const startedAt = Date.now();

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 4096,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: 4 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, max_content_tokens: 8000 },
        RECORD_ENTRANT_TOOL,
      ],
      messages: [
        {
          role: "user",
          content: `Research this person, studio, or organization for a cultural-landscape database entry: "${query.trim()}". Find their role/category, location(s) (city + country - almost always just one, but if they genuinely have multiple real offices/bases, e.g. a studio with locations in several cities, list each one), a factual 2-4 sentence bio, career highlights, up to 3 real notable works or projects (with URLs when you find them), and social/contact links (main website, secondary website if different, Instagram, Twitter/X, TikTok). If the input is a specific URL, fetch it directly first (web_fetch) to read its actual content - that's faster and more reliable than searching around it, and is exactly what it's for. IMPORTANT: try that fetch exactly once. Some sites block AI tools entirely (e.g. via robots.txt) and will never succeed no matter how many times you retry - if the fetch fails, is blocked, times out, or returns nothing useful, do not retry it or keep trying variations of the same URL. Immediately fall back to a normal web search instead, using the site or entity's name (plus the platform, if it's a social profile - e.g. "\"name\" instagram") to find whatever is publicly indexed about them elsewhere, and build your answer from that. Use web_search directly (skip fetch) when starting from just a name with no URL. Be efficient overall: as few tool calls as possible - prefer one fetch and/or 1-2 broad searches that cover most fields at once over one call per field, and stop as soon as you have enough to proceed. Once you've gathered what you can, call record_entrant exactly once with your findings. If some fields can't be found, still call record_entrant and leave those fields null/empty rather than guessing or searching further.`,
        },
      ],
    });
    const blockCounts = response.content.reduce<Record<string, number>>((acc, b) => {
      acc[b.type] = (acc[b.type] ?? 0) + 1;
      return acc;
    }, {});
    console.log(
      `[research] durationMs=${Date.now() - startedAt} stopReason=${response.stop_reason} usage=${JSON.stringify(response.usage)} blocks=${JSON.stringify(blockCounts)}`
    );
  } catch (err) {
    console.log(`[research] failed after durationMs=${Date.now() - startedAt}`);
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

  const usedSlugs = await getUsedSlugs();
  // Checked before buildNodeFromInput mutates usedSlugs with the new
  // entrant's own (possibly disambiguated) slug.
  const duplicateSlug = usedSlugs.has(baseSlug(input.name)) ? baseSlug(input.name) : null;
  const entrant = buildNodeFromInput(input, usedSlugs);

  const possibleDuplicate = duplicateSlug
    ? { id: duplicateSlug, name: (await getEntrantNameById(duplicateSlug)) ?? duplicateSlug }
    : null;

  return NextResponse.json({ entrant, possibleDuplicate });
}
