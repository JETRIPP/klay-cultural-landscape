"use client";

import { useEffect, useRef, useState } from "react";
import { labelForUrl } from "@/lib/links";
import { NEW_CATEGORY_OPTION } from "@/lib/entrantIngest";
import { parseJsonResponse, fallbackErrorMessage } from "@/lib/http";
import ScrollThumb from "@/components/ScrollThumb";
import type { GraphNode } from "@/lib/types";

type Status = "idle" | "researching" | "reviewing" | "confirming" | "error";

interface Props {
  knownCategories: string[];
}

// Researches an entrant via Claude, then holds the result in a review
// window rather than writing it straight to data/graph.json - AI-researched
// bios/links/categories can be wrong, so a human confirms before anything
// joins the map (and eventually the spreadsheet export).
export default function AddEntrantBar({ knownCategories }: Props) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [entrant, setEntrant] = useState<GraphNode | null>(null);
  const [possibleDuplicate, setPossibleDuplicate] = useState<{ id: string; name: string } | null>(null);
  const [category, setCategory] = useState(""); // a knownCategories value, or NEW_CATEGORY_OPTION
  const [newCategory, setNewCategory] = useState("");
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  const modalOpen = status === "reviewing" || status === "confirming";
  // Without this, the page behind the fixed modal overlay can still scroll
  // (especially on mobile, where the root layout allows page scroll) -
  // showing the browser's own native scrollbar instead of just the modal's
  // own internal one, and letting the background drift out from under it.
  useEffect(() => {
    if (!modalOpen) return;
    const html = document.documentElement;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = html.style.overflow;
    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      html.style.overflow = previousHtmlOverflow;
    };
  }, [modalOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed || status === "researching" || status === "confirming") return;
    setStatus("researching");
    setError(null);

    try {
      const res = await fetch("/api/add-entrant/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data) throw new Error(data?.error || fallbackErrorMessage(res));
      const researched = data.entrant as GraphNode;
      setEntrant(researched);
      setPossibleDuplicate((data.possibleDuplicate as { id: string; name: string } | null) ?? null);
      // Claude is prompted to prefer an existing category, but may still
      // propose a new one - default the picker to whichever mode matches
      // what came back instead of silently discarding a novel category.
      if (knownCategories.includes(researched.category)) {
        setCategory(researched.category);
        setNewCategory("");
      } else {
        setCategory(NEW_CATEGORY_OPTION);
        setNewCategory(researched.category);
      }
      setStatus("reviewing");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleApprove() {
    if (!entrant) return;
    const finalCategory = category === NEW_CATEGORY_OPTION ? newCategory.trim() : category;
    if (!finalCategory) {
      setError("Category cannot be empty.");
      return;
    }
    setStatus("confirming");
    setError(null);
    try {
      const res = await fetch("/api/add-entrant/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entrant: { ...entrant, category: finalCategory } }),
      });
      const data = await parseJsonResponse(res);
      if (!res.ok || !data) throw new Error(data?.error || fallbackErrorMessage(res));

      const url = new URL(window.location.href);
      url.searchParams.set("highlight", (data.node as GraphNode).id);
      window.location.href = url.toString();
    } catch (err) {
      setStatus("reviewing");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function handleDiscard() {
    setEntrant(null);
    setPossibleDuplicate(null);
    setQuery("");
    setCategory("");
    setNewCategory("");
    setStatus("idle");
    setError(null);
  }

  const busy = status === "researching" || status === "confirming";

  return (
    <>
      <form onSubmit={handleSubmit} className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
        {status === "error" && <span className="font-mono text-[10px] text-accent">{error}</span>}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add entrant by name or URL..."
          disabled={busy || status === "reviewing"}
          className="w-full border-b border-white/15 bg-transparent py-1 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none disabled:opacity-50 sm:w-64"
        />
        <button
          type="submit"
          disabled={busy || status === "reviewing" || !query.trim()}
          className="font-mono text-xs uppercase tracking-wide text-accent/80 hover:text-accent disabled:opacity-40"
        >
          {status === "researching" ? "Researching…" : "Add"}
        </button>
      </form>

      {modalOpen && entrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative flex max-h-[80dvh] w-full max-w-lg flex-col border border-white/15 bg-ink-raised">
            <div ref={modalContainerRef} className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto py-5 pl-5 pr-3">
              <div ref={modalContentRef} className="flex flex-col gap-4">
                {possibleDuplicate && (
                  <p className="border border-accent/40 bg-accent/10 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-accent">
                    Possible duplicate — &ldquo;{possibleDuplicate.name}&rdquo; already exists in the map
                  </p>
                )}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-white/40">Review before adding</p>
                  <p className="mt-1 text-sm font-medium text-white">{entrant.name}</p>
                  {entrant.locations.some((loc) => loc.raw) && (
                    <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-white/50">
                      {entrant.locations.map((loc) => loc.raw).filter(Boolean).join(" / ")}
                    </p>
                  )}
                </div>

                <div>
                  <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-white/40">Category</p>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full border-b border-white/15 bg-transparent py-1 text-xs text-white focus:border-white focus:outline-none"
                  >
                    {!knownCategories.includes(category) && category !== NEW_CATEGORY_OPTION && (
                      <option value={category} className="bg-ink">{category}</option>
                    )}
                    {knownCategories.map((c) => (
                      <option key={c} value={c} className="bg-ink">{c}</option>
                    ))}
                    <option value={NEW_CATEGORY_OPTION} className="bg-ink">+ New category…</option>
                  </select>
                  {category === NEW_CATEGORY_OPTION && (
                    <input
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Name the new category"
                      className="mt-1.5 w-full border-b border-white/15 bg-transparent py-1 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none"
                    />
                  )}
                </div>

                {entrant.bio && <p className="text-xs leading-relaxed text-white/70">{entrant.bio}</p>}
                {entrant.cv && <p className="text-xs leading-relaxed text-white/50">{entrant.cv}</p>}

                {entrant.notableWork.length > 0 && (
                  <div className="border-t border-white/10 pt-3">
                    <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-white/40">Notable work</p>
                    <div className="flex flex-col gap-1.5">
                      {entrant.notableWork.map((w, i) => (
                        <div key={i} className="flex items-start justify-between gap-2 text-xs text-white/70">
                          <span>{w.label}</span>
                          {w.url && (
                            <a href={w.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-accent/80 underline hover:text-accent">
                              link
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-3 font-mono text-[10px] uppercase tracking-wide text-white/50">
                  {entrant.socials.website && (
                    <a href={entrant.socials.website} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                      {labelForUrl(entrant.socials.website, "Website")}
                    </a>
                  )}
                  {!entrant.socials.website && entrant.socials.mainUrl && (
                    <a href={entrant.socials.mainUrl} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                      {labelForUrl(entrant.socials.mainUrl, "Website")}
                    </a>
                  )}
                  {entrant.socials.instagram && <span>{entrant.socials.instagram}</span>}
                  {entrant.socials.twitter && <span>{entrant.socials.twitter}</span>}
                  {entrant.socials.tiktok && <span>{entrant.socials.tiktok}</span>}
                  {!entrant.socials.mainUrl && !entrant.socials.website && !entrant.socials.instagram && !entrant.socials.twitter && !entrant.socials.tiktok && (
                    <span className="text-white/30">No links found</span>
                  )}
                </div>

                {error && <p className="font-mono text-[10px] text-accent">{error}</p>}

                <div className="flex items-center justify-end gap-4 border-t border-white/10 pt-3">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={status === "confirming"}
                    className="font-mono text-xs uppercase tracking-wide text-white/50 hover:text-white disabled:opacity-40"
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={status === "confirming"}
                    className="font-mono text-xs uppercase tracking-wide text-accent/80 hover:text-accent disabled:opacity-40"
                  >
                    {status === "confirming" ? "Adding…" : "Add to map"}
                  </button>
                </div>
              </div>
            </div>
            <ScrollThumb containerRef={modalContainerRef} contentRef={modalContentRef} />
          </div>
        </div>
      )}
    </>
  );
}
