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
  location: LocationInfo;
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
