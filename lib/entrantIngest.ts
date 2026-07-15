import type { GraphEdge, GraphNode, NotableWork } from "./types";

// Sentinel value for a category <select>'s "propose something new" option -
// shared between the add-entrant review modal and the existing-node
// category editor so both pick a real category name over this reserved one.
export const NEW_CATEGORY_OPTION = "__new_category__";

export const KNOWN_CATEGORIES = [
  "Agency", "Art Director", "Artist / DJ", "Artist / Illustrator", "Audio Hardware",
  "Brand / Studio", "Content Creator", "Creative Director", "Curator", "DJ / Producer",
  "Designer", "Director / Filmmaker", "Fashion", "Fashion Production", "Festival / Event",
  "Institution", "Journalist / Critic", "Listening Room / Bar", "Museum / Institution",
  "Music Journalist", "Music Supervisor", "Newsletter / Blog", "Other", "PR / Agency",
  "Photographer", "Podcast / Radio", "Publication", "Publicist", "Publisher",
  "Retailer / Store", "Stylist", "Venue / Space", "Writer / Editor",
];

export const RECORD_ENTRANT_TOOL = {
  name: "record_entrant",
  description: "Record structured research findings about one cultural-landscape entrant.",
  strict: true,
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "Full name of the person, studio, or organization." },
      category: {
        type: "string",
        description: `Best-fit role/category. Prefer one of the existing categories if it fits: ${KNOWN_CATEGORIES.join(", ")}. Otherwise propose a short, similarly-styled new one.`,
      },
      locationRaw: { type: "string", description: "Location as a short human string, e.g. \"Brooklyn, NY\" or \"London, UK\". Empty string if unknown." },
      locationCity: { type: ["string", "null"], description: "City name only, or null if unknown." },
      locationCountry: { type: ["string", "null"], description: "Country name only (e.g. \"United States\", \"United Kingdom\"), or null if unknown." },
      bio: { type: "string", description: "2-4 sentence factual bio." },
      cv: { type: ["string", "null"], description: "Career highlights / notable roles, or null if none found." },
      notableWork: {
        type: "array",
        description: "Up to 3 notable works/projects, real ones found via search.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short descriptive label for the work." },
            url: { type: ["string", "null"], description: "Direct URL to the work if found, else null." },
            kind: { type: "string", enum: ["listen", "press", "note"], description: "\"listen\" for audio/video platforms, \"press\" for articles/links, \"note\" if there is no URL." },
          },
          required: ["label", "url", "kind"],
          additionalProperties: false,
        },
      },
      mainUrl: { type: ["string", "null"], description: "Primary website or profile URL." },
      website: { type: ["string", "null"], description: "Secondary website, only if different from mainUrl." },
      instagram: { type: ["string", "null"], description: "Instagram handle (with @) or URL." },
      tiktok: { type: ["string", "null"], description: "TikTok handle (with @) or URL." },
      twitter: { type: ["string", "null"], description: "Twitter/X handle (with @) or URL." },
    },
    required: [
      "name", "category", "locationRaw", "locationCity", "locationCountry", "bio", "cv",
      "notableWork", "mainUrl", "website", "instagram", "tiktok", "twitter",
    ],
    additionalProperties: false,
  },
};

export interface RecordEntrantInput {
  name: string;
  category: string;
  locationRaw: string;
  locationCity: string | null;
  locationCountry: string | null;
  bio: string;
  cv: string | null;
  notableWork: { label: string; url: string | null; kind: NotableWork["kind"] }[];
  mainUrl: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
}

export function buildNodeFromInput(input: RecordEntrantInput, usedSlugs: Set<string>): GraphNode {
  return {
    id: slugify(input.name, usedSlugs),
    name: input.name,
    category: input.category,
    location: {
      raw: input.locationRaw || "Unknown",
      city: input.locationCity,
      country: input.locationCountry,
      region: regionForCountry(input.locationCountry),
    },
    bio: input.bio || null,
    cv: input.cv,
    notableWork: input.notableWork.slice(0, 3).map((w) => ({ label: w.label, url: w.url, kind: w.kind })),
    socials: {
      mainUrl: input.mainUrl,
      website: input.website,
      instagram: input.instagram,
      tiktok: input.tiktok,
      twitter: input.twitter,
    },
  };
}

// Mirrors scripts/build_graph.py's COUNTRY_TO_REGION - kept in sync manually
// since the Python pipeline is the canonical source for the bulk import, and
// this is only used for the smaller set of countries a single new entrant is
// likely to report.
const COUNTRY_TO_REGION: Record<string, string> = {
  "United States": "North America",
  Canada: "North America",
  "United Kingdom": "Europe",
  France: "Europe",
  Germany: "Europe",
  Netherlands: "Europe",
  Belgium: "Europe",
  Spain: "Europe",
  Italy: "Europe",
  Switzerland: "Europe",
  Austria: "Europe",
  Sweden: "Europe",
  Denmark: "Europe",
  Finland: "Europe",
  Poland: "Europe",
  Hungary: "Europe",
  Portugal: "Europe",
  Iceland: "Europe",
  Estonia: "Europe",
  Ireland: "Europe",
  "Czech Republic": "Europe",
  Greece: "Europe",
  Japan: "Asia",
  China: "Asia",
  "South Korea": "Asia",
  India: "Asia",
  Taiwan: "Asia",
  "Hong Kong": "Asia",
  "Georgia (country)": "Asia",
  "United Arab Emirates": "Middle East",
  Palestine: "Middle East",
  Ghana: "Africa",
  "South Africa": "Africa",
  Kenya: "Africa",
  Nigeria: "Africa",
  Togo: "Africa",
  Morocco: "Africa",
  Senegal: "Africa",
  Australia: "Oceania",
  Brazil: "South America",
};

export function regionForCountry(country: string | null): string {
  if (!country) return "Unknown";
  return COUNTRY_TO_REGION[country] ?? "Unmapped";
}

export function slugify(name: string, used: Set<string>): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let slug = base;
  let i = 2;
  while (used.has(slug)) {
    slug = `${base}-${i}`;
    i += 1;
  }
  used.add(slug);
  return slug;
}

// Mirrors build_graph.py's name_variants() - a length + generic-word guard so
// a short/common name (e.g. an entrant literally called "SUB") doesn't match
// unrelated substrings across every other node's bio.
const GENERIC_DENYLIST = new Set([
  "paris", "fellowship", "grammy", "forbes", "apple", "spotify", "dazed", "billboard",
  "global", "international", "unknown", "instagram", "tiktok", "twitter", "website",
  "podcast", "radio", "music", "records", "label", "studio", "magazine", "press",
]);

function nameVariants(fullName: string): string[] {
  const variants: string[] = [];
  const m = fullName.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (m) {
    variants.push(m[1].trim());
    variants.push(...m[2].split(/\s*\/\s*/).map((s) => s.trim()));
  } else {
    variants.push(fullName.trim());
  }
  return variants.filter((v) => v.length >= 4 && !GENERIC_DENYLIST.has(v.toLowerCase()));
}

function findContext(text: string, matchStart: number, matchEnd: number): string {
  const left = Math.max(text.lastIndexOf(".", matchStart), text.lastIndexOf("\n", matchStart));
  const candidates = [text.indexOf(".", matchEnd), text.indexOf("!", matchEnd), text.indexOf("?", matchEnd)].filter(
    (p) => p !== -1
  );
  const right = candidates.length ? Math.min(...candidates) : text.length;
  let snippet = text.slice(left + 1, right + 1).trim();
  if (snippet.length > 220) snippet = snippet.slice(0, 217).trimEnd() + "...";
  return snippet;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Named-mention edges between the new node and the existing graph, in both
// directions - the same rule build_graph.py uses for the bulk import, just
// scoped to one new node instead of the full O(n^2) sweep.
export function buildEdgesForNewNode(newNode: GraphNode, existingNodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  const newNodeVariants = nameVariants(newNode.name);
  const newNodeBlob = [newNode.bio, newNode.cv].filter(Boolean).join(" ");

  for (const other of existingNodes) {
    if (other.id === newNode.id) continue;

    // New node mentions an existing node
    if (newNodeBlob) {
      for (const variant of nameVariants(other.name)) {
        const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`);
        const match = pattern.exec(newNodeBlob);
        if (match) {
          const key = `${newNode.id}->${other.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({
              source: newNode.id,
              target: other.id,
              context: findContext(newNodeBlob, match.index, match.index + match[0].length),
            });
          }
          break;
        }
      }
    }

    // Existing node mentions the new node
    const otherBlob = [other.bio, other.cv].filter(Boolean).join(" ");
    if (otherBlob) {
      for (const variant of newNodeVariants) {
        const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`);
        const match = pattern.exec(otherBlob);
        if (match) {
          const key = `${other.id}->${newNode.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            edges.push({
              source: other.id,
              target: newNode.id,
              context: findContext(otherBlob, match.index, match.index + match[0].length),
            });
          }
          break;
        }
      }
    }
  }

  return edges;
}
