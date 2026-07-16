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

// A node with locations in more than one region shows up - and counts -
// under every one of them, not just a single "primary" location. The
// per-node seen-sets keep a node with two cities in the same
// region/country from being double-counted there.
export function computeLocationTree(nodes: GraphNode[]): LocationTree {
  const tree: LocationTree = {};
  for (const n of nodes) {
    const seenRegions = new Set<string>();
    const seenCountries = new Set<string>();
    const seenCities = new Set<string>();
    for (const { region, country, city } of n.locations) {
      if (!country) continue;

      if (!seenRegions.has(region)) {
        seenRegions.add(region);
        tree[region] ??= { count: 0, countries: {} };
        tree[region].count += 1;
      }

      const countryKey = `${region}|${country}`;
      if (!seenCountries.has(countryKey)) {
        seenCountries.add(countryKey);
        tree[region].countries[country] ??= { count: 0, cities: {} };
        tree[region].countries[country].count += 1;
      }

      const cityLabel = city ?? "Unspecified";
      const cityKey = `${countryKey}|${cityLabel}`;
      if (!seenCities.has(cityKey)) {
        seenCities.add(cityKey);
        tree[region].countries[country].cities[cityLabel] =
          (tree[region].countries[country].cities[cityLabel] ?? 0) + 1;
      }
    }
  }
  return tree;
}
