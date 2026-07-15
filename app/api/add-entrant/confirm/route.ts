import { NextRequest, NextResponse } from "next/server";
import { buildEdgesForNewNode, slugify } from "@/lib/entrantIngest";
import { getAllNodesForMatching, getUsedSlugs, insertEntrant } from "@/lib/db";
import type { GraphNode } from "@/lib/types";

// Commits a previewed entrant (from /research) to the database. Re-checks
// the slug against the current table rather than trusting the id minted at
// research time, and retries once on a rare id collision (two teammates
// adding similarly-named entrants at the same moment).
export async function POST(request: NextRequest) {
  const { entrant } = (await request.json()) as { entrant?: GraphNode };
  if (!entrant || !entrant.name) {
    return NextResponse.json({ error: "No entrant data to add." }, { status: 400 });
  }

  const existingNodes = await getAllNodesForMatching();
  const usedSlugs = new Set(existingNodes.map((n) => n.id));

  let newNode: GraphNode = usedSlugs.has(entrant.id)
    ? { ...entrant, id: slugify(entrant.name, usedSlugs) }
    : entrant;
  const newEdges = buildEdgesForNewNode(newNode, existingNodes);

  try {
    await insertEntrant(newNode, newEdges);
  } catch (err) {
    // Unique-violation (id collision from a concurrent add) - re-slugify
    // once against a fresh id set and retry, rather than 500ing on the user.
    const message = err instanceof Error ? err.message : "";
    if (message.includes("duplicate key") || message.includes("unique constraint")) {
      usedSlugs.add(newNode.id);
      newNode = { ...newNode, id: slugify(entrant.name, usedSlugs) };
      try {
        await insertEntrant(newNode, newEdges);
      } catch (retryErr) {
        const retryMessage = retryErr instanceof Error ? retryErr.message : "Unknown error";
        return NextResponse.json({ error: `Failed to add entrant: ${retryMessage}` }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: `Failed to add entrant: ${message || "Unknown error"}` }, { status: 500 });
    }
  }

  return NextResponse.json({ node: newNode, edges: newEdges });
}
