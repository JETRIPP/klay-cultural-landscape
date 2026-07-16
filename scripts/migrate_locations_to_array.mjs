// One-time migration: adds a `locations` JSONB array column alongside the
// existing singular `location` column, backfilling every row as a
// single-element array. Deliberately does NOT drop `location` yet - that
// happens in a separate follow-up once the app code running against
// `locations` is confirmed working in production, so there's a fallback
// if anything looks wrong.
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const envText = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const match = envText.match(/^DATABASE_URL="(.*)"$/m) || envText.match(/^DATABASE_URL=(.*)$/m);
const dbUrl = match[1];
const sql = neon(dbUrl);

await sql`ALTER TABLE entrants ADD COLUMN IF NOT EXISTS locations JSONB`;
await sql`UPDATE entrants SET locations = jsonb_build_array(location) WHERE locations IS NULL`;
await sql`ALTER TABLE entrants ALTER COLUMN locations SET NOT NULL`;

const [{ total }] = await sql`SELECT count(*) AS total FROM entrants`;
const [{ backfilled }] = await sql`SELECT count(*) AS backfilled FROM entrants WHERE jsonb_array_length(locations) = 1`;
console.log(`Total entrants: ${total}. Backfilled to single-element locations array: ${backfilled}.`);

const sample = await sql`SELECT id, name, location, locations FROM entrants LIMIT 3`;
console.log("Sample rows:", JSON.stringify(sample, null, 2));
