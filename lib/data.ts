import { KNOWN_CATEGORIES } from "./entrantIngest";
import type { GraphNode, GraphEdge } from "./types";

// Pure functions, parametrized on nodes/edges rather than a static import -
// the graph now comes from Postgres at request time (see lib/db.ts), so
// these are called from HomeClient via useMemo instead of running once at
// module load.

export function buildNodeById(nodes: GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

export function buildNeighborsIndex(edges: GraphEdge[]) {
  const adjacency = new Map<string, { edge: GraphEdge; otherId: string }[]>();
  for (const e of edges) {
    if (!adjacency.has(e.source)) adjacency.set(e.source, []);
    if (!adjacency.has(e.target)) adjacency.set(e.target, []);
    adjacency.get(e.source)!.push({ edge: e, otherId: e.target });
    adjacency.get(e.target)!.push({ edge: e, otherId: e.source });
  }
  return (id: string) => adjacency.get(id) ?? [];
}

export function computeCategories(nodes: GraphNode[]): { name: string; count: number }[] {
  return Array.from(
    nodes.reduce((map, n) => {
      map.set(n.category, (map.get(n.category) ?? 0) + 1);
      return map;
    }, new Map<string, number>())
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// The seed KNOWN_CATEGORIES list plus whatever categories teammates have
// actually created (e.g. via "+ New category..."), so a custom category
// someone added shows up when editing any other entrant too, not just the
// one it was created on.
export function computeKnownCategoryNames(nodes: GraphNode[]): string[] {
  const names = new Set(KNOWN_CATEGORIES);
  for (const n of nodes) names.add(n.category);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

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

export function computeLocationTree(nodes: GraphNode[]): LocationTree {
  const tree: LocationTree = {};
  for (const n of nodes) {
    const { region, country, city } = n.location;
    if (!country) continue;
    tree[region] ??= { count: 0, countries: {} };
    tree[region].count += 1;
    tree[region].countries[country] ??= { count: 0, cities: {} };
    tree[region].countries[country].count += 1;
    const cityKey = city ?? "Unspecified";
    tree[region].countries[country].cities[cityKey] =
      (tree[region].countries[country].cities[cityKey] ?? 0) + 1;
  }
  return tree;
}
