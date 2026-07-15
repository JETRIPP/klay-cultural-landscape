// One-time loader: reads data/graph.json and inserts everything into the
// Postgres tables created by scripts/schema.sql. Run once after the
// database is provisioned and DATABASE_URL is available in the environment:
//
//   node scripts/migrate_to_postgres.mjs
//
// Safe to re-run against an empty database; will error on a second run
// against an already-populated one (primary key conflicts), which is the
// intended one-time behavior.

import { neon } from "@neondatabase/serverless";
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Pull it from Vercel first (vercel env pull .env.local) and load it, e.g.:");
    console.error("  set -a; source .env.local; set +a; node scripts/migrate_to_postgres.mjs");
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  const graphPath = path.join(__dirname, "..", "data", "graph.json");
  const graph = JSON.parse(await readFile(graphPath, "utf-8"));

  console.log(`Loading ${graph.nodes.length} entrants and ${graph.edges.length} edges...`);

  for (const node of graph.nodes) {
    await sql`
      INSERT INTO entrants (id, name, category, location, bio, cv, notable_work, socials)
      VALUES (
        ${node.id}, ${node.name}, ${node.category}, ${JSON.stringify(node.location)},
        ${node.bio}, ${node.cv}, ${JSON.stringify(node.notableWork)}, ${JSON.stringify(node.socials)}
      )
    `;
  }
  console.log(`Inserted ${graph.nodes.length} entrants.`);

  for (const edge of graph.edges) {
    await sql`INSERT INTO edges (source, target, context) VALUES (${edge.source}, ${edge.target}, ${edge.context})`;
  }
  console.log(`Inserted ${graph.edges.length} edges.`);

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
