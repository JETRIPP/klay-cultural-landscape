import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { GraphData } from "@/lib/types";

const GRAPH_PATH = path.join(process.cwd(), "data", "graph.json");

// Permanently removes one entrant and every edge that references it. The
// frontend gates this behind its own confirm step - this route trusts
// whatever id it's given, since the confirmation already happened in the UI.
export async function POST(request: NextRequest) {
  const { id } = (await request.json()) as { id?: string };
  if (!id) {
    return NextResponse.json({ error: "An entrant id is required." }, { status: 400 });
  }

  const graphRaw = await fs.readFile(GRAPH_PATH, "utf-8");
  const graph = JSON.parse(graphRaw) as GraphData;

  const nodeIndex = graph.nodes.findIndex((n) => n.id === id);
  if (nodeIndex === -1) {
    return NextResponse.json({ error: "Entrant not found." }, { status: 404 });
  }

  graph.nodes.splice(nodeIndex, 1);
  graph.edges = graph.edges.filter((e) => e.source !== id && e.target !== id);

  await fs.writeFile(GRAPH_PATH, JSON.stringify(graph, null, 2), "utf-8");

  return NextResponse.json({ success: true });
}
