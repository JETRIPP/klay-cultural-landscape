"""
Reads the KLAY Cultural Landscape spreadsheet and emits data/graph.json:
nodes (entrants, with normalized location + tagged outbound links) and
edges (named-mention connections, each with the quoted source snippet).

Usage: python3 scripts/build_graph.py [path/to/xlsx]
"""

import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

import openpyxl

DEFAULT_XLSX = "/Users/justintripp/Desktop/KLAY SPREADSHEETS/KLAY_ CULTURAL LANDSCAPE.xlsx"
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "graph.json"

# ---------------------------------------------------------------------------
# Location normalization
# ---------------------------------------------------------------------------

US_STATES = {
    "alabama": "United States", "al": "United States", "alaska": "United States",
    "arizona": "United States", "az": "United States", "arkansas": "United States", "ar": "United States",
    "california": "United States", "ca": "United States", "colorado": "United States", "co": "United States",
    "connecticut": "United States", "ct": "United States", "delaware": "United States", "de": "United States",
    "florida": "United States", "fl": "United States", "georgia": "United States",  # US state, not the country
    "hawaii": "United States", "hi": "United States", "idaho": "United States", "id": "United States",
    "illinois": "United States", "il": "United States", "indiana": "United States", "in": "United States",
    "iowa": "United States", "ia": "United States", "kansas": "United States", "ks": "United States",
    "kentucky": "United States", "ky": "United States", "louisiana": "United States", "la": "United States",
    "maine": "United States", "me": "United States", "maryland": "United States", "md": "United States",
    "massachusetts": "United States", "ma": "United States", "michigan": "United States", "mi": "United States",
    "minnesota": "United States", "mn": "United States", "mississippi": "United States", "ms": "United States",
    "missouri": "United States", "mo": "United States", "montana": "United States", "mt": "United States",
    "nebraska": "United States", "ne": "United States", "nevada": "United States", "nv": "United States",
    "new hampshire": "United States", "nh": "United States", "new jersey": "United States", "nj": "United States",
    "new mexico": "United States", "nm": "United States", "new york": "United States", "ny": "United States",
    "north carolina": "United States", "nc": "United States", "north dakota": "United States", "nd": "United States",
    "ohio": "United States", "oh": "United States", "oklahoma": "United States", "ok": "United States",
    "oregon": "United States", "or": "United States", "pennsylvania": "United States", "pa": "United States",
    "rhode island": "United States", "ri": "United States", "south carolina": "United States", "sc": "United States",
    "south dakota": "United States", "sd": "United States", "tennessee": "United States", "tn": "United States",
    "texas": "United States", "tx": "United States", "utah": "United States", "ut": "United States",
    "vermont": "United States", "vt": "United States", "virginia": "United States", "va": "United States",
    "washington": "United States", "wa": "United States", "wisconsin": "United States", "wi": "United States",
    "wyoming": "United States", "wy": "United States", "washington dc": "United States", "dc": "United States",
    "washington, d.c.": "United States",
    "nyc": "United States",
}

COUNTRY_ALIASES = {
    "usa": "United States", "us": "United States", "u.s.": "United States",
    "united states": "United States",
    "uk": "United Kingdom", "britain": "United Kingdom", "england": "United Kingdom",
    "scotland": "United Kingdom", "wales": "United Kingdom", "northern ireland": "United Kingdom",
    "united kingdom": "United Kingdom",
    "uae": "United Arab Emirates",
    "france": "France", "germany": "Germany", "netherlands": "Netherlands", "belgium": "Belgium",
    "spain": "Spain", "italy": "Italy", "switzerland": "Switzerland", "austria": "Austria",
    "sweden": "Sweden", "denmark": "Denmark", "finland": "Finland", "poland": "Poland",
    "hungary": "Hungary", "portugal": "Portugal", "iceland": "Iceland", "estonia": "Estonia",
    "ireland": "Ireland", "czech republic": "Czech Republic",
    "japan": "Japan", "china": "China", "south korea": "South Korea", "india": "India",
    "taiwan": "Taiwan", "hong kong": "Hong Kong", "georgia": "Georgia (country)",
    "ghana": "Ghana", "south africa": "South Africa", "kenya": "Kenya", "nigeria": "Nigeria",
    "togo": "Togo", "morocco": "Morocco", "senegal": "Senegal",
    "australia": "Australia", "brazil": "Brazil", "canada": "Canada",
    "west bank": "Palestine",
}

# Standalone cities that appear without a country/state token in the sheet.
CITY_COUNTRY = {
    "paris": "France", "berlin": "Germany", "barcelona": "Spain", "madrid": "Spain",
    "dakar": "Senegal", "lomé": "Togo", "vienna": "Austria", "munich": "Germany",
    "amsterdam": "Netherlands", "amsterdam noord": "Netherlands", "brussels": "Belgium",
    "copenhagen": "Denmark", "dublin": "Ireland", "helsinki": "Finland", "lisbon": "Portugal",
    "malmö": "Sweden", "marseille": "France", "melbourne": "Australia", "milan": "Italy",
    "montreal": "Canada", "montréal": "Canada", "nairobi": "Kenya", "reykjavík": "Iceland",
    "rotterdam": "Netherlands", "seoul": "South Korea", "stockholm": "Sweden", "sydney": "Australia",
    "taipei": "Taiwan", "tallinn": "Estonia", "tbilisi": "Georgia (country)", "tokyo": "Japan",
    "toulouse": "France", "turin": "Italy", "utrecht": "Netherlands", "vancouver": "Canada",
    "warsaw": "Poland", "athens": "Greece", "budapest": "Hungary", "florence": "Italy",
    "hamburg": "Germany", "cologne": "Germany", "cape town": "South Africa", "accra": "Ghana",
    "shenzhen": "China", "new delhi": "India", "bethlehem": "Palestine",
    "london": "United Kingdom", "bristol": "United Kingdom", "glasgow": "United Kingdom",
    "edinburgh": "United Kingdom", "liverpool": "United Kingdom", "manchester": "United Kingdom",
    "essex": "United Kingdom", "staffordshire": "United Kingdom", "margate": "United Kingdom",
    "southend-on-sea": "United Kingdom", "dalston": "United Kingdom", "hackney": "United Kingdom",
    "hackney central": "United Kingdom", "peckham": "United Kingdom", "somerset": "United Kingdom",
    "isle of skye": "United Kingdom", "king's cross": "United Kingdom",
    "nashville": "United States", "chicago": "United States", "detroit": "United States",
    "austin": "United States", "portland": "United States", "oakland": "United States",
    "west palm beach": "United States", "miami": "United States", "san francisco": "United States",
    "bay area": "United States", "boston": "United States", "seattle": "United States",
    "las vegas": "United States", "providence": "United States", "minneapolis": "United States",
    "jacksonville": "United States", "gainesville": "United States", "indianapolis": "United States",
    "ogden": "United States", "sparta": "United States",
    "marrakech": "Morocco", "sardinia": "Italy", "são paulo": "Brazil", "greece": "Greece",
}

COUNTRY_TO_REGION = {
    "United States": "North America", "Canada": "North America",
    "United Kingdom": "Europe", "France": "Europe", "Germany": "Europe", "Netherlands": "Europe",
    "Belgium": "Europe", "Spain": "Europe", "Italy": "Europe", "Switzerland": "Europe",
    "Austria": "Europe", "Sweden": "Europe", "Denmark": "Europe", "Finland": "Europe",
    "Poland": "Europe", "Hungary": "Europe", "Portugal": "Europe", "Iceland": "Europe",
    "Estonia": "Europe", "Ireland": "Europe", "Czech Republic": "Europe", "Greece": "Europe",
    "Japan": "Asia", "China": "Asia", "South Korea": "Asia", "India": "Asia", "Taiwan": "Asia",
    "Hong Kong": "Asia", "Georgia (country)": "Asia",
    "United Arab Emirates": "Middle East", "Palestine": "Middle East",
    "Ghana": "Africa", "South Africa": "Africa", "Kenya": "Africa", "Nigeria": "Africa",
    "Togo": "Africa", "Morocco": "Africa", "Senegal": "Africa",
    "Australia": "Oceania", "Brazil": "South America",
}

_word_re_cache = {}


def _word_regex(token):
    if token not in _word_re_cache:
        _word_re_cache[token] = re.compile(r"\b" + re.escape(token) + r"\b", re.IGNORECASE)
    return _word_re_cache[token]


# Neighborhoods/boroughs that should be grouped under their metro city rather
# than left as their own city bucket - otherwise "New York" fractures into
# Brooklyn, Queens, Greenpoint, Park Slope, Tribeca, etc. and a filter for
# "entrants in New York" silently misses most of them.
NEIGHBORHOOD_TO_METRO = {
    "new york": "New York", "brooklyn": "New York", "queens": "New York",
    "manhattan": "New York", "bed-stuy": "New York", "crown heights": "New York",
    "east williamsburg": "New York", "greenpoint": "New York", "gowanus": "New York",
    "park slope": "New York", "red hook": "New York", "carroll gardens": "New York",
    "ridgewood": "New York", "greenwich village": "New York", "lower manhattan": "New York",
    "tribeca": "New York", "midtown east": "New York", "lower east side": "New York",
    "noho": "New York",
    "los angeles": "Los Angeles", "downtown los angeles": "Los Angeles",
    "hollywood": "Los Angeles", "arts district": "Los Angeles", "culver city": "Los Angeles",
    "highland park": "Los Angeles", "west hollywood": "Los Angeles", "west los angeles": "Los Angeles",
    "humboldt park": "Chicago", "wicker park": "Chicago",
}


def normalize_location(raw):
    if not raw or raw.strip().lower() == "unknown":
        return {"raw": raw or "Unknown", "city": None, "country": None, "region": "Unknown"}
    if raw.strip().lower() in ("global", "international"):
        return {"raw": raw, "city": None, "country": None, "region": "Global"}

    combined = {**COUNTRY_ALIASES, **US_STATES}
    best = None  # (position, country)
    for token, country in combined.items():
        m = _word_regex(token).search(raw)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), country)

    if best is None:
        for token, country in CITY_COUNTRY.items():
            m = _word_regex(token).search(raw)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), country)

    country = best[1] if best else None
    region = COUNTRY_TO_REGION.get(country, "Other") if country else "Unmapped"

    # crude city guess: first comma-separated segment of the first "/"-delimited chunk
    first_chunk = re.split(r"\s*/\s*|\s\+\s", raw)[0]
    city = first_chunk.split(",")[0].strip()
    city = re.sub(r"\s*\(.*?\)", "", city).strip()
    city = NEIGHBORHOOD_TO_METRO.get(city.lower(), city)

    return {"raw": raw, "city": city or None, "country": country, "region": region}


# ---------------------------------------------------------------------------
# Notable-work link labeling
# ---------------------------------------------------------------------------

LISTEN_DOMAINS = {
    "spotify.com", "soundcloud.com", "podcasts.apple.com", "acast.com", "mixcloud.com",
    "bandcamp.com", "youtube.com", "youtu.be", "vimeo.com", "ra.co",
}

# Proper display names for domains that would otherwise fall back to a
# mangled capitalized-domain-root guess (e.g. "nts.live" -> "Nts",
# "i-d.co" -> "I-d"). Covers both known platforms (so a link to Instagram
# always says "Instagram" rather than whatever the URL happens to look
# like) and outlets that recur often enough in this sheet to be worth
# naming exactly right.
KNOWN_PLATFORM_LABELS = {
    "instagram.com": "Instagram",
    "twitter.com": "Twitter / X",
    "x.com": "Twitter / X",
    "tiktok.com": "TikTok",
    "youtube.com": "YouTube",
    "youtu.be": "YouTube",
    "spotify.com": "Spotify",
    "soundcloud.com": "SoundCloud",
    "bandcamp.com": "Bandcamp",
    "substack.com": "Substack",
    "linktr.ee": "Linktree",
    "linkedin.com": "LinkedIn",
    "residentadvisor.net": "Resident Advisor",
    "ra.co": "Resident Advisor",
    "discogs.com": "Discogs",
    "mixcloud.com": "Mixcloud",
    "vimeo.com": "Vimeo",
    "are.na": "Are.na",
}


URL_ANYWHERE_RE = re.compile(r"https?://\S+", re.IGNORECASE)


def label_link(value):
    """Most Notable Work cells are plain descriptive text (e.g. "JW Anderson
    PR representation") with no URL at all - only ~13% of the ~1060 cells in
    this sheet are pure URLs. But a further slice are descriptive text with
    a URL embedded partway through (e.g. "Acast feed — https://..."), which
    an earlier version of this function missed entirely by only checking
    whether the *whole* cell was a URL. Searching for a URL anywhere in the
    cell - and using any surrounding descriptive text as the label - recovers
    those as real clickable links instead of silently downgrading them to
    non-clickable notes."""
    if not value:
        return None
    value = value.strip()
    match = URL_ANYWHERE_RE.search(value)
    if not match:
        return {"url": None, "label": value, "kind": "note"}

    # Trailing punctuation (closing parens, sentence-final periods, etc.) is
    # almost never part of the actual URL.
    url = match.group(0).rstrip(").,;:]}—")
    prefix = value[: match.start()].strip(" —-:—")
    suffix = value[match.end() :].strip(" —-:—")

    try:
        parsed = urlparse(url)
    except ValueError:
        return {"url": None, "label": value, "kind": "note"}
    domain = parsed.netloc.replace("www.", "")
    kind = "listen" if any(d in domain for d in LISTEN_DOMAINS) else "press"

    descriptive = prefix or suffix
    if descriptive:
        label = descriptive
    else:
        slug = parsed.path.rstrip("/").split("/")[-1]
        slug = re.sub(r"[-_]+", " ", slug).strip()
        slug = re.sub(r"\.\w{2,5}$", "", slug)  # strip file extensions
        domain_label = KNOWN_PLATFORM_LABELS.get(
            domain, domain.split(".")[0].capitalize() if domain else url
        )
        if slug:
            label = f"{domain_label} — {slug[:80]}"
        else:
            # A bare root-domain URL with no path and no surrounding
            # descriptive text is almost always the entrant's own
            # homepage/profile listed as a "notable work" - naming it for
            # what it is beats guessing at a display name from a domain
            # that's often just a concatenated name (e.g. "ryanmcginley.com"
            # -> "Ryanmcginley").
            label = KNOWN_PLATFORM_LABELS.get(domain, "Official site")

    return {"url": url, "label": label, "kind": kind}


# ---------------------------------------------------------------------------
# Named-mention edge extraction
# ---------------------------------------------------------------------------

GENERIC_DENYLIST = {
    "paris", "fellowship", "grammy", "forbes", "apple", "spotify", "dazed", "billboard",
    "global", "international", "unknown", "instagram", "tiktok", "twitter", "website",
    "podcast", "radio", "music", "records", "label", "studio", "magazine", "press",
    "the lot", "public", "art", "design", "media", "sound", "video", "film",
    "sub", "nothing", "bird", "canvas", "darling", "figures", "murmur", "martha",
    "kennedy", "alice", "frieze", "monocle", "flaunt", "stylus",
}


def name_variants(full_name):
    """Returns a list of (variant_text, is_primary) for mention matching.
    Applies a length + generic-word guard to every variant (not just aliases) -
    a handful of entrants have single common-English-word names (e.g. an agency
    literally called "SUB", an institution called "Fellowship") that otherwise
    match unrelated phrases like "Guggenheim Fellowship" or "SUB:STANCE"."""
    variants = []
    m = re.match(r"^(.*?)\s*\((.*)\)\s*$", full_name)
    if m:
        main, alias_blob = m.group(1).strip(), m.group(2).strip()
        variants.append(main)
        variants.extend(a.strip() for a in re.split(r"\s*/\s*", alias_blob))
    else:
        variants.append(full_name.strip())
    return [v for v in variants if v and len(v) >= 4 and v.lower() not in GENERIC_DENYLIST]


def find_context(text, match_start, match_end):
    # expand to the surrounding sentence, delimited by . ! ? or newlines
    left = max(text.rfind(".", 0, match_start), text.rfind("\n", 0, match_start))
    right_candidates = [p for p in (text.find(".", match_end), text.find("!", match_end), text.find("?", match_end)) if p != -1]
    right = min(right_candidates) if right_candidates else len(text)
    snippet = text[left + 1:right + 1].strip()
    if len(snippet) > 220:
        snippet = snippet[:217].rstrip() + "..."
    return snippet


def build_edges(nodes):
    # id -> compiled variant patterns
    node_variants = {}
    for node in nodes:
        node_variants[node["id"]] = name_variants(node["name"])

    edges = []
    seen = set()
    for source in nodes:
        blob = " ".join(filter(None, [source.get("bio"), source.get("cv")]))
        if not blob:
            continue
        for target in nodes:
            if target["id"] == source["id"]:
                continue
            for variant in node_variants[target["id"]]:
                pattern = re.compile(r"\b" + re.escape(variant) + r"\b")
                m = pattern.search(blob)
                if m:
                    key = (source["id"], target["id"])
                    if key not in seen:
                        seen.add(key)
                        edges.append({
                            "source": source["id"],
                            "target": target["id"],
                            "context": find_context(blob, m.start(), m.end()),
                        })
                    break
    return edges


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def slugify(name, used):
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    slug = base
    i = 2
    while slug in used:
        slug = f"{base}-{i}"
        i += 1
    used.add(slug)
    return slug


def main():
    xlsx_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_XLSX
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(min_row=2, values_only=True))

    used_slugs = set()
    nodes = []
    for row in rows:
        (name, category, main_url, location, bio, cv, work1, work2, work3,
         email, instagram, tiktok, twitter, website) = row
        if not name:
            continue
        nodes.append({
            "id": slugify(name, used_slugs),
            "name": name,
            "category": category,
            "location": normalize_location(location),
            "bio": bio,
            "cv": cv,
            "notableWork": [l for l in (label_link(work1), label_link(work2), label_link(work3)) if l],
            "socials": {
                "mainUrl": main_url,
                "instagram": instagram,
                "tiktok": tiktok,
                "twitter": twitter,
                "website": website,
            },
        })

    print(f"Parsed {len(nodes)} nodes")

    unmapped = sorted({n["location"]["raw"] for n in nodes if n["location"]["region"] == "Unmapped"})
    if unmapped:
        print(f"\n{len(unmapped)} location string(s) could not be mapped to a country - review:")
        for u in unmapped:
            print(f"  - {u}")

    edges = build_edges(nodes)
    print(f"\nExtracted {len(edges)} named-mention edges")
    print("\nSample edges:")
    id_to_name = {n["id"]: n["name"] for n in nodes}
    for e in edges[:30]:
        print(f"  {id_to_name[e['source']]!r} -> {id_to_name[e['target']]!r} :: {e['context'][:100]}")

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump({"nodes": nodes, "edges": edges}, f, ensure_ascii=False, indent=2)
    print(f"\nWrote {OUT_PATH}")


if __name__ == "__main__":
    main()
