"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import FacetBar from "@/components/FacetBar";
import GraphCanvas from "@/components/GraphCanvas";
import DetailPanel from "@/components/DetailPanel";
import EmptyState from "@/components/EmptyState";
import Wordmark from "@/components/Wordmark";
import AddEntrantBar from "@/components/AddEntrantBar";
import { buildNodeById, buildNeighborsIndex, computeCategories, computeLocationTree } from "@/lib/data";
import { colorForCategory } from "@/lib/colors";
import type { GraphNode, GraphEdge } from "@/lib/types";

interface Props {
  initialNodes: GraphNode[];
  initialEdges: GraphEdge[];
}

export default function HomeClient({ initialNodes, initialEdges }: Props) {
  const nodes = initialNodes;
  const edges = initialEdges;

  const nodeById = useMemo(() => buildNodeById(nodes), [nodes]);
  const neighborsOf = useMemo(() => buildNeighborsIndex(edges), [edges]);
  const categories = useMemo(() => computeCategories(nodes), [nodes]);
  const locationTree = useMemo(() => computeLocationTree(nodes), [nodes]);

  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [region, setRegion] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [seedId, setSeedId] = useState<string | null>(null);
  const [pinnedExtra, setPinnedExtra] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [linkDistance, setLinkDistance] = useState(80);

  const wordmarkRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLImageElement>(null);
  const [logoHeight, setLogoHeight] = useState<number | null>(null);
  // Natural width / natural height of the logo asset, measured so the
  // rotated-90°-clockwise footprint below can be sized without hardcoding
  // the file's aspect ratio. A cached image can finish loading before this
  // effect attaches an onLoad listener, so `complete` is checked directly
  // rather than relying on the load event alone.
  const [logoAspect, setLogoAspect] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (wordmarkRef.current) setLogoHeight(wordmarkRef.current.getBoundingClientRect().height);
    const img = logoRef.current;
    if (img?.complete && img.naturalWidth) setLogoAspect(img.naturalWidth / img.naturalHeight);
  }, []);

  const hasFacet = selectedCategories.size > 0 || region !== null;
  const hasActiveFilters = hasFacet || seedId !== null;

  function leaveSeedMode() {
    setSeedId(null);
  }

  function toggleCategory(name: string) {
    leaveSeedMode();
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function changeRegion(r: string | null) {
    leaveSeedMode();
    setRegion(r);
    setCountry(null);
    setCity(null);
  }
  function changeCountry(c: string | null) {
    leaveSeedMode();
    setCountry(c);
    setCity(null);
  }
  function changeCity(c: string | null) {
    leaveSeedMode();
    setCity(c);
  }

  function selectSearchResult(id: string) {
    setSeedId(id);
    setSelectedNodeId(id);
  }

  // A node just added via the query bar arrives as a ?highlight=<id> param
  // after the reload that picks up the freshly-written data - jump straight
  // to it, then drop the param so a later refresh doesn't re-fire.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const highlight = params.get("highlight");
    if (highlight && nodeById.has(highlight)) {
      selectSearchResult(highlight);
      const url = new URL(window.location.href);
      url.searchParams.delete("highlight");
      window.history.replaceState({}, "", url.toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeById]);

  function reset() {
    setSelectedCategories(new Set());
    setRegion(null);
    setCountry(null);
    setCity(null);
    setSeedId(null);
    setPinnedExtra(new Set());
    setSelectedNodeId(null);
  }

  const primaryIds = useMemo(() => {
    if (seedId) {
      const ids = new Set<string>([seedId]);
      for (const { otherId } of neighborsOf(seedId)) ids.add(otherId);
      return ids;
    }
    if (!hasFacet) return new Set<string>();
    const ids = new Set<string>();
    for (const n of nodes) {
      if (selectedCategories.size > 0 && !selectedCategories.has(n.category)) continue;
      if (region && n.location.region !== region) continue;
      if (country && n.location.country !== country) continue;
      if (city && (n.location.city ?? "Unspecified") !== city) continue;
      ids.add(n.id);
    }
    return ids;
  }, [seedId, hasFacet, selectedCategories, region, country, city, nodes, neighborsOf]);

  const effectiveIds = useMemo(() => {
    const ids = new Set(primaryIds);
    for (const id of pinnedExtra) ids.add(id);
    return ids;
  }, [primaryIds, pinnedExtra]);

  const { ghostIds, links } = useMemo(() => {
    const ghosts = new Set<string>();
    const solid: { source: string; target: string; isGhost: boolean }[] = [];
    const boundary: { source: string; target: string; isGhost: boolean }[] = [];
    for (const e of edges) {
      const sIn = effectiveIds.has(e.source);
      const tIn = effectiveIds.has(e.target);
      if (sIn && tIn) solid.push({ source: e.source, target: e.target, isGhost: false });
      else if (sIn || tIn) {
        const outer = sIn ? e.target : e.source;
        ghosts.add(outer);
        boundary.push({ source: e.source, target: e.target, isGhost: true });
      }
    }
    return { ghostIds: ghosts, links: [...solid, ...boundary] };
  }, [effectiveIds, edges]);

  const visibleNodes = useMemo(() => {
    const list = [];
    for (const id of effectiveIds) {
      const n = nodeById.get(id);
      if (n) list.push(n);
    }
    for (const id of ghostIds) {
      const n = nodeById.get(id);
      if (n) list.push(n);
    }
    return list;
  }, [effectiveIds, ghostIds, nodeById]);

  const visibleCategories = useMemo(() => {
    const seen = new Map<string, number>();
    for (const id of effectiveIds) {
      const n = nodeById.get(id);
      if (n) seen.set(n.category, (seen.get(n.category) ?? 0) + 1);
    }
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]);
  }, [effectiveIds, nodeById]);

  function handleNodeClick(id: string) {
    if (ghostIds.has(id)) setPinnedExtra((prev) => new Set(prev).add(id));
    setSelectedNodeId(id);
  }
  function pinExtra(id: string) {
    setPinnedExtra((prev) => new Set(prev).add(id));
    setSelectedNodeId(id);
  }

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) ?? null : null;
  const outsideCount = effectiveIds.size > 0 ? ghostIds.size : 0;

  return (
    <div className="flex h-screen flex-col gap-3 overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <div
          className="relative"
          style={
            logoHeight && logoAspect
              ? { width: logoHeight / logoAspect, height: logoHeight }
              : undefined
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={logoRef}
            src="/klay-logo-white.png"
            alt="KLAY"
            onLoad={(e) => setLogoAspect(e.currentTarget.naturalWidth / e.currentTarget.naturalHeight)}
            style={
              logoHeight
                ? {
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    width: logoHeight,
                    height: "auto",
                    transform: "translate(-50%, -50%) rotate(90deg)",
                  }
                : undefined
            }
            className="opacity-90"
          />
        </div>
        <div ref={wordmarkRef}>
          <Wordmark top="CULTURAL" bottom="LANDSCAPE" className="text-xs font-medium text-white" />
        </div>
        <AddEntrantBar />
      </div>
      <FacetBar
        categories={categories}
        selectedCategories={selectedCategories}
        onToggleCategory={toggleCategory}
        locationTree={locationTree}
        region={region}
        country={country}
        city={city}
        onChangeRegion={changeRegion}
        onChangeCountry={changeCountry}
        onChangeCity={changeCity}
        allNodes={nodes}
        onSelectSearchResult={selectSearchResult}
        onReset={reset}
        hasActiveFilters={hasActiveFilters}
      />

      {hasActiveFilters && (
        <p className="font-mono text-[11px] uppercase tracking-wide text-white/40">
          {primaryIds.size} entrant{primaryIds.size === 1 ? "" : "s"} shown
          {seedId ? ` · centered on ${nodeById.get(seedId)?.name}` : ""}
          {outsideCount > 0 && <span> · {outsideCount} connection{outsideCount === 1 ? "" : "s"} outside this view</span>}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div
          className="relative h-full min-h-0 overflow-hidden rounded-lg border border-white/[0.06]"
          style={{
            background:
              "radial-gradient(ellipse at 50% 38%, rgba(255,255,255,0.035), transparent 62%), var(--color-ink-raised)",
          }}
        >
          {!hasActiveFilters ? (
            <EmptyState topCategories={categories.slice(0, 6)} onPickCategory={toggleCategory} />
          ) : (
            <>
              <GraphCanvas
                nodes={visibleNodes}
                ghostIds={ghostIds}
                links={links}
                selectedId={selectedNodeId}
                onNodeClick={handleNodeClick}
                linkDistance={linkDistance}
              />
              {visibleCategories.length > 0 && (
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/60 backdrop-blur-sm">
                  {visibleCategories.slice(0, 6).map(([name]) => (
                    <span key={name} className="flex items-center gap-1.5">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: colorForCategory(name) }}
                      />
                      {name}
                    </span>
                  ))}
                </div>
              )}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/40 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-wide text-white/60 backdrop-blur-sm">
                <span>Density</span>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={5}
                  value={linkDistance}
                  onChange={(e) => setLinkDistance(Number(e.target.value))}
                  className="w-20 range-thin"
                />
              </div>
            </>
          )}
        </div>

        <div className="h-full min-h-0">
          {selectedNode ? (
            <DetailPanel
              node={selectedNode}
              inViewIds={effectiveIds}
              nodeById={nodeById}
              neighborsOf={neighborsOf}
              onSelectNode={(id) => setSelectedNodeId(id)}
              onPinExtra={pinExtra}
            />
          ) : (
            <div className="flex h-full items-center justify-center border-l border-white/10 pl-4 text-center text-xs text-white/40">
              Select a node to see its bio, links, and connections.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
