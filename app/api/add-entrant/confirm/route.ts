import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { buildEdgesForNewNode, slugify } from "@/lib/entrantIngest";
import type { GraphData, GraphNode } from "@/lib/types";

const GRAPH_PATH = path.join(process.cwd(), "data", "graph.json");

// Commits a previewed entrant (from /research) to data/graph.json. Re-reads
// the file fresh rather than trusting the id minted at research time, in
// case something else was added to the graph in between.
export async function POST(request: NextRequest) {
  const { entrant } = (await request.json()) as { entrant?: GraphNode };
  if (!entrant || !entrant.name) {
    return NextResponse.json({ error: "No entrant data to add." }, { status: 400 });
  }

  const graphRaw = await fs.readFile(GRAPH_PATH, "utf-8");
  const graph = JSON.parse(graphRaw) as GraphData;

  const usedSlugs = new Set(graph.nodes.map((n) => n.id));
  const newNode: GraphNode = usedSlugs.has(entrant.id)
    ? { ...entrant, id: slugify(entrant.name, usedSlugs) }
    : (usedSlugs.add(entrant.id), entrant);

  const newEdges = buildEdgesForNewNode(newNode, graph.nodes);

  graph.nodes.push(newNode);
  graph.edges.push(...newEdges);
  await fs.writeFile(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");

  return NextResponse.json({ node: newNode, edges: newEdges });
}
