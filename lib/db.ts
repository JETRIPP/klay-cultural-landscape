import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { GraphData, GraphNode, GraphEdge } from "./types";

// neon() throws immediately if DATABASE_URL is empty, so it can't be built
// eagerly at module load - `next build` imports every route module to
// collect page data even for routes that never run at build time, which
// would fail before a database is ever provisioned. Constructing it lazily,
// on first real use, keeps the build working with no DATABASE_URL set and
// only requires it once an actual request comes in.
let _sql: NeonQueryFunction<false, false> | null = null;
function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL is not set.");
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql(strings, ...values);
}

interface EntrantRow {
  id: string;
  name: string;
  category: string;
  location: GraphNode["location"];
  bio: string | null;
  cv: string | null;
  notable_work: GraphNode["notableWork"];
  socials: GraphNode["socials"];
}

interface EdgeRow {
  source: string;
  target: string;
  context: string;
}

function rowToNode(row: EntrantRow): GraphNode {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    location: row.location,
    bio: row.bio,
    cv: row.cv,
    notableWork: row.notable_work,
    socials: row.socials,
  };
}

export async function getGraphData(): Promise<GraphData> {
  const [entrantRows, edgeRows] = await Promise.all([
    sql`SELECT id, name, category, location, bio, cv, notable_work, socials FROM entrants`,
    sql`SELECT source, target, context FROM edges`,
  ]);

  return {
    nodes: (entrantRows as EntrantRow[]).map(rowToNode),
    edges: (edgeRows as EdgeRow[]).map((e) => ({ source: e.source, target: e.target, context: e.context })),
  };
}

// Used by add-entrant/research and add-entrant/confirm to mint a slug that
// doesn't collide with an entrant already in the database.
export async function getUsedSlugs(): Promise<Set<string>> {
  const rows = (await sql`SELECT id FROM entrants`) as { id: string }[];
  return new Set(rows.map((r) => r.id));
}

// A single indexed lookup by primary key - used to name a possible-duplicate
// warning (research/route.ts already knows the *id* a name would collide
// with via getUsedSlugs(), but not the existing entrant's display name).
export async function getEntrantNameById(id: string): Promise<string | null> {
  const rows = (await sql`SELECT name FROM entrants WHERE id = ${id}`) as { name: string }[];
  return rows[0]?.name ?? null;
}

// buildEdgesForNewNode() needs full bio/cv text for every existing node to
// do its named-mention regex matching, not just ids - fine at this dataset's
// size (~500 rows, a few hundred KB of text total).
export async function getAllNodesForMatching(): Promise<GraphNode[]> {
  const rows = (await sql`SELECT id, name, category, location, bio, cv, notable_work, socials FROM entrants`) as EntrantRow[];
  return rows.map(rowToNode);
}

export async function insertEntrant(node: GraphNode, edges: GraphEdge[]): Promise<void> {
  await sql`
    INSERT INTO entrants (id, name, category, location, bio, cv, notable_work, socials)
    VALUES (
      ${node.id}, ${node.name}, ${node.category}, ${JSON.stringify(node.location)},
      ${node.bio}, ${node.cv}, ${JSON.stringify(node.notableWork)}, ${JSON.stringify(node.socials)}
    )
  `;
  for (const edge of edges) {
    await sql`INSERT INTO edges (source, target, context) VALUES (${edge.source}, ${edge.target}, ${edge.context})`;
  }
}

export async function deleteEntrant(id: string): Promise<boolean> {
  // ON DELETE CASCADE on the edges table's foreign keys removes any edges
  // referencing this id automatically - no manual cleanup needed here.
  const result = (await sql`DELETE FROM entrants WHERE id = ${id} RETURNING id`) as { id: string }[];
  return result.length > 0;
}

export async function updateEntrantCategory(id: string, category: string): Promise<GraphNode | null> {
  const rows = (await sql`
    UPDATE entrants SET category = ${category}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, name, category, location, bio, cv, notable_work, socials
  `) as EntrantRow[];
  return rows.length > 0 ? rowToNode(rows[0]) : null;
}
