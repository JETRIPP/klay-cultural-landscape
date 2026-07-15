import raw from "@/data/graph.json";
import type { GraphData, GraphNode, GraphEdge } from "./types";

const data = raw as GraphData;

export const nodes: GraphNode[] = data.nodes;
export const edges: GraphEdge[] = data.edges;

export const nodeById = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));

// adjacency: nodeId -> list of {edge, otherId}
const adjacency = new Map<string, { edge: GraphEdge; otherId: string }[]>();
for (const n of nodes) adjacency.set(n.id, []);
for (const e of edges) {
  adjacency.get(e.source)?.push({ edge: e, otherId: e.target });
  adjacency.get(e.target)?.push({ edge: e, otherId: e.source });
}
export function neighborsOf(id: string) {
  return adjacency.get(id) ?? [];
}

export const categories: { name: string; count: number }[] = Array.from(
  nodes.reduce((map, n) => {
    map.set(n.category, (map.get(n.category) ?? 0) + 1);
    return map;
  }, new Map<string, number>())
)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count);

// region -> country -> city -> count, built from nodes with a resolved country
export interface LocationTree {
  [region: string]: {
    count: number;
    countries: {
      [country: string]: {
        count: number;
        cities: { [city: string]: number };
      };
    };
  };
}

export const locationTree: LocationTree = {};
for (const n of nodes) {
  const { region, country, city } = n.location;
  if (!country) continue;
  locationTree[region] ??= { count: 0, countries: {} };
  locationTree[region].count += 1;
  locationTree[region].countries[country] ??= { count: 0, cities: {} };
  locationTree[region].countries[country].count += 1;
  const cityKey = city ?? "Unspecified";
  locationTree[region].countries[country].cities[cityKey] =
    (locationTree[region].countries[country].cities[cityKey] ?? 0) + 1;
}
