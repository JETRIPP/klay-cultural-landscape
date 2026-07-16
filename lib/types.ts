export interface LocationInfo {
  raw: string;
  city: string | null;
  country: string | null;
  region: string;
}

export interface NotableWork {
  url: string | null;
  label: string;
  kind: "press" | "listen" | "note";
}

export interface Socials {
  mainUrl: string | null;
  instagram: string | null;
  tiktok: string | null;
  twitter: string | null;
  website: string | null;
}

export interface GraphNode {
  id: string;
  name: string;
  category: string;
  // Always at least one entry; locations[0] is the "primary" location used
  // wherever only a single compact location needs to be shown (search
  // results, the DetailPanel header). Entrants with a real multi-city/region
  // presence (e.g. a studio with several office locations) have more.
  locations: LocationInfo[];
  bio: string | null;
  cv: string | null;
  notableWork: NotableWork[];
  socials: Socials;
}

export interface GraphEdge {
  source: string;
  target: string;
  context: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
