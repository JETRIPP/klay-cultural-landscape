"use client";

import { useEffect, useRef, useState } from "react";
import { colorForCategory } from "@/lib/colors";
import { labelForUrl } from "@/lib/links";
import { KNOWN_CATEGORIES, NEW_CATEGORY_OPTION } from "@/lib/entrantIngest";
import ScrollThumb from "@/components/ScrollThumb";
import type { GraphNode, GraphEdge } from "@/lib/types";

interface Props {
  node: GraphNode;
  inViewIds: Set<string>;
  nodeById: Map<string, GraphNode>;
  neighborsOf: (id: string) => { edge: GraphEdge; otherId: string }[];
  onSelectNode: (id: string) => void;
  onPinExtra: (id: string) => void;
}

function SocialLinks({ node }: { node: GraphNode }) {
  const links: { label: string; url: string }[] = [];
  if (node.socials.website) links.push({ label: labelForUrl(node.socials.website, "Website"), url: node.socials.website });
  else if (node.socials.mainUrl) links.push({ label: labelForUrl(node.socials.mainUrl, "Website"), url: node.socials.mainUrl });
  if (node.socials.instagram) {
    const url = node.socials.instagram.startsWith("http")
      ? node.socials.instagram
      : `https://instagram.com/${node.socials.instagram.replace(/^@/, "")}`;
    links.push({ label: node.socials.instagram.startsWith("@") ? node.socials.instagram : "Instagram", url });
  }
  if (node.socials.twitter) {
    const url = node.socials.twitter.startsWith("http")
      ? node.socials.twitter
      : `https://x.com/${node.socials.twitter.replace(/^@/, "")}`;
    links.push({ label: node.socials.twitter.startsWith("@") ? node.socials.twitter : "Twitter / X", url });
  }
  if (node.socials.tiktok) {
    const url = node.socials.tiktok.startsWith("http")
      ? node.socials.tiktok
      : `https://tiktok.com/@${node.socials.tiktok.replace(/^@/, "")}`;
    links.push({ label: "TikTok", url });
  }
  if (links.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 font-mono text-xs uppercase tracking-wide text-white/60">
      {links.map((l, i) => (
        <span key={l.url} className="flex items-center gap-3">
          {i > 0 && <span className="text-white/20">·</span>}
          <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">
            {l.label}
          </a>
        </span>
      ))}
    </div>
  );
}

export default function DetailPanel({ node, inViewIds, nodeById, neighborsOf, onSelectNode, onPinExtra }: Props) {
  const connections = neighborsOf(node.id)
    .map(({ edge, otherId }) => ({ edge, other: nodeById.get(otherId) }))
    .filter((c): c is { edge: typeof c.edge; other: GraphNode } => Boolean(c.other));

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [deleteStep, setDeleteStep] = useState<"idle" | "confirming" | "deleting">("idle");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [newCategoryDraft, setNewCategoryDraft] = useState("");
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  // Selecting a different node should never carry over a pending delete
  // confirmation, or an in-progress category edit, from whatever was
  // selected before.
  useEffect(() => {
    setDeleteStep("idle");
    setDeleteError(null);
    setEditingCategory(false);
    setCategoryError(null);
  }, [node.id]);

  async function handleDelete() {
    setDeleteStep("deleting");
    setDeleteError(null);
    try {
      const res = await fetch("/api/delete-entrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: node.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete entrant.");
      window.location.reload();
    } catch (err) {
      setDeleteStep("confirming");
      setDeleteError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  function startEditingCategory() {
    if (KNOWN_CATEGORIES.includes(node.category)) {
      setCategoryDraft(node.category);
      setNewCategoryDraft("");
    } else {
      setCategoryDraft(NEW_CATEGORY_OPTION);
      setNewCategoryDraft(node.category);
    }
    setCategoryError(null);
    setEditingCategory(true);
  }

  async function handleSaveCategory() {
    const finalCategory = categoryDraft === NEW_CATEGORY_OPTION ? newCategoryDraft.trim() : categoryDraft;
    if (!finalCategory) {
      setCategoryError("Category cannot be empty.");
      return;
    }
    setCategorySaving(true);
    setCategoryError(null);
    try {
      const res = await fetch("/api/update-entrant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: node.id, category: finalCategory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update category.");
      window.location.reload();
    } catch (err) {
      setCategorySaving(false);
      setCategoryError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <div className="relative h-full">
      <div
        ref={containerRef}
        className="scrollbar-hidden h-full overflow-y-auto border-l border-white/10 pr-3 pl-4"
      >
        <div ref={contentRef} className="flex flex-col gap-4">
          <div>
            <p className="text-sm font-medium text-white">{node.name}</p>
            {!editingCategory ? (
              <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wide text-white/50">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: colorForCategory(node.category) }}
                />
                {node.category}
                {node.location.raw && <span className="text-white/30">· {node.location.raw}</span>}
                <button
                  onClick={startEditingCategory}
                  className="font-mono text-[10px] uppercase tracking-wide text-white/30 hover:text-accent"
                >
                  edit
                </button>
              </p>
            ) : (
              <div className="mt-1.5 flex flex-col gap-1.5">
                <select
                  value={categoryDraft}
                  onChange={(e) => setCategoryDraft(e.target.value)}
                  disabled={categorySaving}
                  className="w-full border-b border-white/15 bg-transparent py-1 text-xs text-white focus:border-white focus:outline-none disabled:opacity-50"
                >
                  {!KNOWN_CATEGORIES.includes(categoryDraft) && categoryDraft !== NEW_CATEGORY_OPTION && (
                    <option value={categoryDraft} className="bg-ink">{categoryDraft}</option>
                  )}
                  {KNOWN_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-ink">{c}</option>
                  ))}
                  <option value={NEW_CATEGORY_OPTION} className="bg-ink">+ New category…</option>
                </select>
                {categoryDraft === NEW_CATEGORY_OPTION && (
                  <input
                    value={newCategoryDraft}
                    onChange={(e) => setNewCategoryDraft(e.target.value)}
                    placeholder="Name the new category"
                    disabled={categorySaving}
                    className="w-full border-b border-white/15 bg-transparent py-1 text-xs text-white placeholder:text-white/30 focus:border-white focus:outline-none disabled:opacity-50"
                  />
                )}
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setEditingCategory(false)}
                    disabled={categorySaving}
                    className="font-mono text-xs uppercase tracking-wide text-white/50 hover:text-white disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCategory}
                    disabled={categorySaving}
                    className="font-mono text-xs uppercase tracking-wide text-accent/80 hover:text-accent disabled:opacity-40"
                  >
                    {categorySaving ? "Saving…" : "Save"}
                  </button>
                </div>
                {categoryError && <p className="font-mono text-[10px] text-accent">{categoryError}</p>}
              </div>
            )}
          </div>

          {node.bio && <p className="text-xs leading-relaxed text-white/70">{node.bio}</p>}

          <SocialLinks node={node} />

          {node.notableWork.length > 0 && (
            <div className="border-t border-white/15 pt-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-white/40">Notable work</p>
              <div className="flex flex-col">
                {node.notableWork.map((w, i) => {
                  const kindColor =
                    w.kind === "listen" ? "#7fd9b6" : w.kind === "press" ? "#9dbaea" : "rgba(217,205,176,0.4)";
                  const content = (
                    <>
                      <span className="leading-snug break-words">{w.label}</span>
                      <span
                        className="mt-0.5 shrink-0 font-mono text-[10px] uppercase tracking-wide"
                        style={{ color: kindColor }}
                      >
                        {w.kind}
                      </span>
                    </>
                  );
                  return w.url ? (
                    <a
                      key={i}
                      href={w.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start justify-between gap-2 border-t border-white/10 py-1.5 text-xs text-white/80 underline decoration-white/25 underline-offset-2 first:border-t-0 hover:text-white hover:decoration-white"
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                      key={i}
                      className="flex items-start justify-between gap-2 border-t border-white/10 py-1.5 text-xs text-white/60 first:border-t-0"
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {connections.length > 0 && (
            <div className="border-t border-white/15 pt-3">
              <p className="mb-1.5 font-mono text-[10px] uppercase tracking-wide text-white/40">
                Connections ({connections.length})
              </p>
              <div className="flex flex-col gap-2">
                {connections.map(({ edge, other }) => {
                  const outside = !inViewIds.has(other.id);
                  const direction = edge.source === node.id ? "mentions" : "mentioned by";
                  return (
                    <div key={other.id} className="border-t border-white/10 pt-2 first:border-t-0 first:pt-0">
                      <button
                        onClick={() => (outside ? onPinExtra(other.id) : onSelectNode(other.id))}
                        className="text-left text-xs font-medium text-white/90 hover:underline"
                      >
                        {other.name}
                      </button>
                      <span className="ml-1.5 font-mono text-[10px] text-white/40">{direction}</span>
                      {outside && (
                        <button
                          onClick={() => onPinExtra(other.id)}
                          className="ml-1.5 font-mono text-[10px] uppercase tracking-wide text-accent/80 hover:text-accent hover:underline"
                        >
                          outside view · click to add
                        </button>
                      )}
                      <p className="mt-1 text-[11px] italic leading-snug text-white/40">&ldquo;{edge.context}&rdquo;</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="border-t border-white/15 pt-3">
            {deleteStep === "idle" ? (
              <button
                onClick={() => setDeleteStep("confirming")}
                className="font-mono text-[10px] uppercase tracking-wide text-white/30 hover:text-accent"
              >
                Delete this entrant
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="font-mono text-[10px] uppercase tracking-wide text-accent/80">
                  {`Permanently remove ${node.name} from the map? This can’t be undone.`}
                </p>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setDeleteStep("idle")}
                    disabled={deleteStep === "deleting"}
                    className="font-mono text-xs uppercase tracking-wide text-white/50 hover:text-white disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleteStep === "deleting"}
                    className="font-mono text-xs uppercase tracking-wide text-accent hover:text-accent/80 disabled:opacity-40"
                  >
                    {deleteStep === "deleting" ? "Deleting…" : "Delete permanently"}
                  </button>
                </div>
                {deleteError && <p className="font-mono text-[10px] text-accent">{deleteError}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
      <ScrollThumb containerRef={containerRef} contentRef={contentRef} />
    </div>
  );
}
