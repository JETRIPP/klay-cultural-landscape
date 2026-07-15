// Proper display names for domains that would otherwise all collapse to the
// same generic "Main link"/"Website" fallback - most entrants only filled in
// the sheet's "Main URL" column, so without this every one of them reads as
// the identical word regardless of what the link actually was. Shared by
// DetailPanel (existing entrants) and the add-entrant review modal (a
// freshly-researched one), so a link is labeled the same way everywhere.
const PLATFORM_LABELS: Record<string, string> = {
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
};

export function labelForUrl(url: string, fallback: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return PLATFORM_LABELS[host] ?? fallback;
  } catch {
    return fallback;
  }
}
