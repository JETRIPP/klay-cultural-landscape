import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { GraphData } from "@/lib/types";

const GRAPH_PATH = path.join(process.cwd(), "data", "graph.json");

// Currently only re-categorizes an existing entrant - a research pass or a
// manual edit can put someone in the wrong bucket, and this is the fix
// without deleting and re-adding them (which would also lose their edges).
export async function POST(request: NextRequest) {
  const { id, category } = (await request.json()) as { id?: string; category?: string };
  if (!id || !category || !category.trim()) {
    return NextResponse.json({ error: "An entrant id and non-empty category are required." }, { status: 400 });
  }

  const graphRaw = await fs.readFile(GRAPH_PATH, "utf-8");
  const graph = JSON.parse(graphRaw) as GraphData;

  const node = graph.nodes.find((n) => n.id === id);
  if (!node) {
    return NextResponse.json({ error: "Entrant not found." }, { status: 404 });
  }

  node.category = category.trim();
  await fs.writeFile(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");

  return NextResponse.json({ node });
}
