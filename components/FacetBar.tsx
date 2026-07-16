"use client";

import { useMemo, useState } from "react";
import { colorForCategory, contrastTextColor, pillGradient } from "@/lib/colors";
import type { LocationTree } from "@/lib/data";
import type { GraphNode } from "@/lib/types";

interface Props {
  categories: { name: string; count: number }[];
  selectedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  locationTree: LocationTree;
  region: string | null;
  country: string | null;
  city: string | null;
  onChangeRegion: (region: string | null) => void;
  onChangeCountry: (country: string | null) => void;
  onChangeCity: (city: string | null) => void;
  allNodes: GraphNode[];
  onSelectSearchResult: (id: string) => void;
  onReset: () => void;
  hasActiveFilters: boolean;
}

export default function FacetBar({
  categories,
  selectedCategories,
  onToggleCategory,
  locationTree,
  region,
  country,
  city,
  onChangeRegion,
  onChangeCountry,
  onChangeCity,
  allNodes,
  onSelectSearchResult,
  onReset,
  hasActiveFilters,
}: Props) {
  const [query, setQuery] = useState("");

  const countries = region ? Object.keys(locationTree[region]?.countries ?? {}).sort() : [];
  const cities = region && country
    ? Object.keys(locationTree[region].countries[country]?.cities ?? {}).sort()
    : [];

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return allNodes
      .filter(
        (n) =>
          n.name.toLowerCase().includes(q) ||
          n.locations.some(
            (loc) =>
              loc.raw?.toLowerCase().includes(q) ||
              loc.city?.toLowerCase().includes(q) ||
              loc.country?.toLowerCase().includes(q)
          )
      )
      .slice(0, 8);
  }, [query, allNodes]);

  return (
    <div className="flex flex-col gap-3 border-b border-white/10 pb-3">
      <div className="scrollbar-hidden -mx-4 flex flex-nowrap items-center gap-x-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:gap-y-2 sm:overflow-visible sm:px-0 sm:pb-0">
        {categories.map((c) => {
          const active = selectedCategories.has(c.name);
          const color = colorForCategory(c.name);
          const textColor = active ? contrastTextColor(color) : "#ffffff";
          return (
            <button
              key={c.name}
              onClick={() => onToggleCategory(c.name)}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors"
              style={{
                background: active ? pillGradient(c.name) : "transparent",
                color: textColor,
              }}
            >
              {!active && <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />}
              {c.name}
              <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-white/70"}`}>
                {c.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <select
          value={region ?? ""}
          onChange={(e) => onChangeRegion(e.target.value || null)}
          className="bg-transparent px-0.5 py-1 font-mono text-xs uppercase tracking-wide text-white"
        >
          <option value="" className="bg-ink">All regions</option>
          {Object.keys(locationTree)
            .sort()
            .map((r) => (
              <option key={r} value={r} className="bg-ink">
                {r} ({locationTree[r].count})
              </option>
            ))}
        </select>

        {region && (
          <select
            value={country ?? ""}
            onChange={(e) => onChangeCountry(e.target.value || null)}
            className="border-b border-white/15 bg-transparent px-0.5 py-1 font-mono text-xs uppercase tracking-wide text-parchment/70"
          >
            <option value="" className="bg-ink">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c} className="bg-ink">
                {c} ({locationTree[region].countries[c].count})
              </option>
            ))}
          </select>
        )}

        {region && country && (
          <select
            value={city ?? ""}
            onChange={(e) => onChangeCity(e.target.value || null)}
            className="border-b border-white/15 bg-transparent px-0.5 py-1 font-mono text-xs uppercase tracking-wide text-parchment/70"
          >
            <option value="" className="bg-ink">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c} className="bg-ink">
                {c} ({locationTree[region].countries[country].cities[c]})
              </option>
            ))}
          </select>
        )}

        <div className="relative w-full sm:ml-auto sm:w-56">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute left-0.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white"
          >
            <circle cx="10.5" cy="10.5" r="6.5" />
            <line x1="20" y1="20" x2="15.5" y2="15.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search entrants"
            className="w-full border-b border-white/15 bg-transparent py-1 pl-5 pr-0.5 text-xs text-white focus:border-white focus:outline-none"
          />
          {results.length > 0 && (
            <div className="absolute right-0 top-full z-10 mt-1 w-full overflow-hidden border border-white/10 bg-ink-raised text-xs shadow-lg">
              {results.map((n) => (
                <button
                  key={n.id}
                  onClick={() => {
                    onSelectSearchResult(n.id);
                    setQuery("");
                  }}
                  className="block w-full border-b border-white/5 px-3 py-1.5 text-left text-white/80 last:border-b-0 hover:bg-white/5"
                >
                  {n.name}
                  <span className="ml-1.5 text-white/40">
                    {n.category}
                    {n.locations[0]?.raw ? ` · ${n.locations[0].raw}` : ""}
                    {n.locations.length > 1 ? ` +${n.locations.length - 1}` : ""}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="font-mono text-xs uppercase tracking-wide text-white/50 hover:text-white"
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
