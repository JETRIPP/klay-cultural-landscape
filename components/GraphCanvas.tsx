"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { colorForCategory, glowColorForCategory, lightenColor, darkenColor } from "@/lib/colors";
import type { GraphNode } from "@/lib/types";

// react-force-graph-2d touches `window` at import time, so it must be loaded
// client-side only. Its generic prop types don't survive `next/dynamic`
// cleanly, so this wrapper deliberately keeps the graph-data shape as `any`
// at the component boundary and re-asserts the real shape inside callbacks.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false }) as any;

export interface CanvasNode {
  id: string;
  name: string;
  category: string;
  location: string | null;
  isGhost: boolean;
  x?: number;
  y?: number;
}

function locationLabel(n: GraphNode): string | null {
  const { city, country, raw } = n.location;
  if (city) return city;
  if (country) return country;
  return raw || null;
}

export interface CanvasLink {
  source: string;
  target: string;
  isGhost: boolean;
}

// The canvas context is pre-scaled by the current zoom (globalScale), so a
// value drawn as "N graph-space units" naturally ends up N*globalScale
// screen pixels - shrinking as the view zooms out to fit more nodes, growing
// as it zooms in. That's the desired feel (density changes should read as a
// zoom, not just a rearrangement), but left alone it can shrink below
// legibility on large/zoomed-out views. Clamping the resulting on-screen
// size to a floor (and a ceiling, so a tiny 2-node view doesn't render
// giant blobs) keeps the natural zoom sensation while staying readable.
function clampedScreenSize(naturalGraphSpaceSize: number, globalScale: number, min: number, max: number): number {
  const onScreen = naturalGraphSpaceSize * globalScale;
  return Math.min(max, Math.max(min, onScreen)) / globalScale;
}

interface Props {
  nodes: GraphNode[];
  ghostIds: Set<string>;
  links: { source: string; target: string; isGhost: boolean }[];
  selectedId: string | null;
  onNodeClick: (id: string) => void;
  linkDistance: number;
}

export default function GraphCanvas({
  nodes,
  ghostIds,
  links,
  selectedId,
  onNodeClick,
  linkDistance,
}: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // react-force-graph-2d defaults its canvas to window.innerWidth/innerHeight
  // when no explicit size is given, which mismatches this container's actual
  // clipped box and throws off node hit-testing (clicks land on the wrong
  // node). Measuring the container and passing width/height keeps the
  // canvas's internal coordinate system in sync with what's on screen.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Don't rely solely on the observer's first callback to arrive - it can
    // occasionally be delayed past this component's own render (seen as an
    // intermittent blank canvas right after navigation), so measure once
    // synchronously up front too.
    setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Applying a new link distance to the *live* simulation (rather than
  // remounting) is what gives a smooth push in/out instead of a hard reset.
  // The real cause of the earlier collapse wasn't reheating itself - it was
  // d3-force's charge (repulsion) force dividing by a near-zero distance
  // whenever two nodes ended up very close together, which produces
  // Infinity/NaN forces that then contaminate every node's position on
  // subsequent ticks. `distanceMin` is d3-force's own guard against exactly
  // this, set once below. Debounced so a drag reheats once it settles rather
  // than on every intermediate value.
  const isFirstRun = useRef(true);
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    if (isFirstRun.current) {
      fg.d3Force("link")?.distance(linkDistance);
      fg.d3Force("charge")?.distanceMin(1);
      isFirstRun.current = false;
      return;
    }
    const timeout = setTimeout(() => {
      fg.d3Force("link")?.distance(linkDistance);
      fg.d3ReheatSimulation();
    }, 150);
    return () => clearTimeout(timeout);
  }, [linkDistance]);

  const graphData = useMemo(() => {
    const canvasNodes: CanvasNode[] = nodes.map((n) => ({
      id: n.id,
      name: n.name,
      category: n.category,
      location: locationLabel(n),
      isGhost: ghostIds.has(n.id),
    }));
    const canvasLinks: CanvasLink[] = links.map((l) => ({ ...l }));
    return { nodes: canvasNodes, links: canvasLinks };
  }, [nodes, ghostIds, links]);

  // The react-force-graph-2d ref only forwards a fixed subset of the
  // underlying library's methods (centerAt/zoom/zoomToFit/d3Force/etc.) -
  // `graphData()` is *not* one of them, so it can't be used to read a
  // node's live position back out. Instead, this reads x/y directly off
  // the exact node objects handed to the `graphData` prop above - the
  // simulation mutates those objects in place every tick (that's also how
  // nodeCanvasObject below gets each node's current position), so a ref
  // that's refreshed every render gives the effect below a live lookup
  // without retriggering it on every data change.
  const liveNodesRef = useRef(graphData.nodes);
  liveNodesRef.current = graphData.nodes;

  const MIN_ZOOM = 0.3;
  const MAX_ZOOM = 8;

  // Centering and zooming are deliberately two separate actions rather than
  // one combined pan+scale on every click. Panning toward the selected node
  // *while also* rescaling made the zoom's anchor a moving target mid-
  // transition (a slight swoop rather than a clean zoom). Centering once,
  // right when a selection is made, means every subsequent +/- click is a
  // pure scale around a point that's already dead center - a tight, fixed
  // focus with nothing else moving underneath it.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || typeof fg.centerAt !== "function" || !selectedId) return;
    const target = liveNodesRef.current.find((n) => n.id === selectedId);
    if (target?.x != null && target?.y != null) fg.centerAt(target.x, target.y, 450);
  }, [selectedId]);

  function zoomBy(factor: number) {
    const fg = fgRef.current;
    if (!fg || typeof fg.zoom !== "function") return;
    const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fg.zoom() * factor));
    fg.zoom(nextK, 350);
  }

  // force-graph's onBackgroundClick fires only for clicks that miss every
  // node - exactly "negative space" - but the library has no built-in
  // double-click equivalent (confirmed against its own type defs), so this
  // detects one manually from consecutive background-click timestamps.
  // Unlike the +/- buttons above, a double-click here is deliberately
  // choosing a *new* focus point rather than re-scaling an already-centered
  // one, so panning to it and zooming happen together in one motion instead
  // of being split into two steps.
  const lastBgClickRef = useRef(0);
  const DOUBLE_CLICK_MS = 320;

  function handleBackgroundClick(event: MouseEvent) {
    const now = Date.now();
    const isDoubleClick = now - lastBgClickRef.current < DOUBLE_CLICK_MS;
    lastBgClickRef.current = isDoubleClick ? 0 : now;
    if (!isDoubleClick) return;

    const fg = fgRef.current;
    const el = containerRef.current;
    if (!fg || !el || typeof fg.screen2GraphCoords !== "function") return;
    const rect = el.getBoundingClientRect();
    const graphPoint = fg.screen2GraphCoords(event.clientX - rect.left, event.clientY - rect.top);
    const nextK = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fg.zoom() * 1.8));
    fg.centerAt(graphPoint.x, graphPoint.y, 400);
    fg.zoom(nextK, 400);
  }

  return (
    // touch-action: none stops the browser's own pan/pinch-zoom gesture
    // handling from fighting with force-graph's own touch-driven pan/zoom
    // (both would otherwise try to interpret the same drag/pinch).
    <div ref={containerRef} className="relative h-full w-full touch-none">
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2 bg-black/40 px-2 py-1 font-mono text-xs text-white/60 backdrop-blur-sm">
        <button
          onClick={() => zoomBy(1 / 1.4)}
          aria-label="Zoom out"
          className="px-1 leading-none hover:text-white"
        >
          −
        </button>
        <span className="text-white/20">|</span>
        <button
          onClick={() => zoomBy(1.4)}
          aria-label="Zoom in"
          className="px-1 leading-none hover:text-white"
        >
          +
        </button>
      </div>
      {size.width > 0 && (
        <ForceGraph2D
          ref={fgRef}
          width={size.width}
          height={size.height}
          graphData={graphData}
          backgroundColor="rgba(0,0,0,0)"
          nodeId="id"
          nodeRelSize={4}
          // Suppresses force-graph's default native-browser hover tooltip
          // (which would otherwise show the node's name a second time) -
          // name and location are already drawn permanently under every
          // node, so a hover tooltip is redundant.
          nodeLabel={() => ""}
          linkDirectionalArrowLength={0}
          d3AlphaDecay={0.03}
          warmupTicks={20}
          linkWidth={(l: CanvasLink) => (l.isGhost ? 1 : 1.25)}
          linkColor={(l: CanvasLink) => (l.isGhost ? "rgba(255,255,255,0.5)" : "rgba(217,205,176,0.28)")}
          linkLineDash={(l: CanvasLink) => (l.isGhost ? [2, 2] : null)}
          linkCurvature={0.2}
          onNodeClick={(n: CanvasNode) => onNodeClick(n.id)}
          onBackgroundClick={handleBackgroundClick}
          onEngineStop={() => {
            // The camera's zoom/pan only ever matches the layout's extent at
            // whatever moment it was last fit - it doesn't auto-adjust as the
            // link distance changes the graph's overall spread. Re-fitting
            // whenever the simulation settles (initial load, and every
            // density-driven reheat) keeps everything framed instead of
            // drifting out of view.
            fgRef.current?.zoomToFit(400, 40);
          }}
          nodeCanvasObject={(node: CanvasNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const n = node;
            const isSelected = n.id === selectedId;
            const x = node.x ?? 0;
            const y0 = node.y ?? 0;
            const radius = clampedScreenSize(n.isGhost ? 3 : isSelected ? 7 : 5, globalScale, 3, 16);
            const color = colorForCategory(n.category);

            // Ghost nodes' own fill is drawn at reduced alpha further down,
            // which would otherwise let a dashed link passing underneath
            // show through the node instead of stopping at its silhouette.
            // An opaque mask in the panel's own background color, drawn
            // first at full alpha, blocks that regardless of the node's own
            // translucency - the line reads as terminating behind the node.
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(x, y0, radius, 0, 2 * Math.PI);
            ctx.fillStyle = "#15120e";
            ctx.fill();

            ctx.globalAlpha = n.isGhost ? 0.35 : 1;

            // A tight, near-white specular point offset toward the
            // upper-left, dropping hard through the base color to a
            // near-black rim - reads as a glossy, high-voltage bead rather
            // than a flat disc or a softly-shaded sphere. Selection draws a
            // brighter tint of that *same* hue as a dense sunburst, matched
            // directly to the reference: a soft outer bloom, a near-white
            // hot core, and a tightly packed fringe of thin, near-uniform
            // rays (not a sparse, wildly uneven sea-urchin).
            const sphereGradient = ctx.createRadialGradient(
              x - radius * 0.4,
              y0 - radius * 0.4,
              radius * 0.02,
              x,
              y0,
              radius * 1.1
            );
            sphereGradient.addColorStop(0, lightenColor(color, 0.85));
            sphereGradient.addColorStop(0.25, lightenColor(color, 0.3));
            sphereGradient.addColorStop(0.55, color);
            sphereGradient.addColorStop(1, darkenColor(color, 0.55));

            // A subtle ambient glow cast by the node itself when selected -
            // applied to the sphere fill's own draw call so it wraps the
            // node's actual silhouette rather than a separate shape.
            if (isSelected) {
              ctx.shadowColor = glowColorForCategory(n.category, 0.7, 0.4);
              ctx.shadowBlur = clampedScreenSize(14, globalScale, 8, 22);
            }
            ctx.beginPath();
            ctx.arc(x, y0, radius, 0, 2 * Math.PI);
            ctx.fillStyle = sphereGradient;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (isSelected) {
              // Soft ambient haze behind the rays - a big, heavily blurred
              // wash of color, the way the reference's burst sits in a
              // diffuse glow rather than just having sharp lines on black.
              ctx.shadowColor = glowColorForCategory(n.category, 0.5, 0.3);
              ctx.shadowBlur = clampedScreenSize(22, globalScale, 14, 34);
              ctx.beginPath();
              ctx.arc(x, y0, radius * 0.4, 0, 2 * Math.PI);
              ctx.fillStyle = glowColorForCategory(n.category, 0.3, 0.3);
              ctx.fill();
              ctx.shadowBlur = 0;

              // Dense ray fringe, starting almost at the node's exact
              // center (right under the core, not at its outer edge) and
              // reaching well beyond it, with strongly irregular lengths
              // and each ray feathering from solid near the center to fully
              // transparent at its tip - matched directly to the
              // reference's sea-urchin burst rather than an even ring.
              const rayCount = 40;
              const innerR = radius * 0.15;
              const baseLen = radius * 2.1;
              ctx.lineWidth = clampedScreenSize(0.6, globalScale, 0.4, 1);
              for (let i = 0; i < rayCount; i++) {
                const angle = (i / rayCount) * Math.PI * 2;
                // Deterministic pseudo-random per ray index (not angle) so
                // lengths look irregular/organic rather than a smooth wobble.
                const seed = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
                const rand = seed - Math.floor(seed);
                const outerR = innerR + baseLen * (0.3 + rand * 0.8);
                const x1 = x + Math.cos(angle) * innerR;
                const y1 = y0 + Math.sin(angle) * innerR;
                const x2 = x + Math.cos(angle) * outerR;
                const y2 = y0 + Math.sin(angle) * outerR;
                const rayGradient = ctx.createLinearGradient(x1, y1, x2, y2);
                rayGradient.addColorStop(0, glowColorForCategory(n.category, 0.9, 0.25));
                rayGradient.addColorStop(1, glowColorForCategory(n.category, 0, 0.25));
                ctx.strokeStyle = rayGradient;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
              }

              // Small bright core on top of the rays - much smaller than
              // the node itself, fading to fully transparent well before
              // its own edge so there's no harsh boundary line.
              const coreR = radius * 0.4;
              const whiteGlow = ctx.createRadialGradient(x, y0, 0, x, y0, coreR);
              whiteGlow.addColorStop(0, "rgba(255,255,255,0.95)");
              whiteGlow.addColorStop(0.6, "rgba(255,255,255,0.35)");
              whiteGlow.addColorStop(1, "rgba(255,255,255,0)");
              ctx.beginPath();
              ctx.arc(x, y0, coreR, 0, 2 * Math.PI);
              ctx.fillStyle = whiteGlow;
              ctx.fill();
            }
            ctx.globalAlpha = 1;

            {
              const fontSize = clampedScreenSize(isSelected ? 13 : 11, globalScale, 10, 22);
              let y = y0 + radius + clampedScreenSize(4, globalScale, 2, 6);

              ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "top";
              ctx.fillStyle = n.isGhost ? "rgba(217,205,176,0.4)" : "rgba(237,230,218,0.9)";
              ctx.fillText(n.name, x, y);
              y += fontSize + clampedScreenSize(2, globalScale, 1, 3);

              if (n.location && !n.isGhost) {
                const subFontSize = fontSize * 0.78;
                ctx.font = `${subFontSize}px "Space Mono", monospace`;
                ctx.fillStyle = "rgba(217,205,176,0.5)";
                ctx.fillText(n.location.toUpperCase(), x, y);
              }
            }
          }}
          nodePointerAreaPaint={(node: CanvasNode, color: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const x = node.x ?? 0;
            const y0 = node.y ?? 0;
            const isSelected = node.id === selectedId;
            const radius = clampedScreenSize(node.isGhost ? 4 : isSelected ? 9 : 6, globalScale, 3.5, 20);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y0, radius, 0, 2 * Math.PI);
            ctx.fill();

            // Also cover the name/location label drawn below the node
            // (same layout math as nodeCanvasObject) so clicking the text
            // itself - not just the small node dot - selects it too.
            const fontSize = clampedScreenSize(isSelected ? 13 : 11, globalScale, 10, 22);
            const labelY = y0 + radius + clampedScreenSize(4, globalScale, 2, 6);
            ctx.font = `500 ${fontSize}px "Inter", sans-serif`;
            let labelWidth = ctx.measureText(node.name).width;
            let labelHeight = fontSize;

            if (node.location && !node.isGhost) {
              const subFontSize = fontSize * 0.78;
              const lineGap = clampedScreenSize(2, globalScale, 1, 3);
              ctx.font = `${subFontSize}px "Space Mono", monospace`;
              labelWidth = Math.max(labelWidth, ctx.measureText(node.location.toUpperCase()).width);
              labelHeight += lineGap + subFontSize;
            }

            const padX = clampedScreenSize(3, globalScale, 2, 6);
            const padY = clampedScreenSize(2, globalScale, 1, 3);
            ctx.fillRect(x - labelWidth / 2 - padX, labelY - padY, labelWidth + padX * 2, labelHeight + padY * 2);
          }}
        />
      )}
    </div>
  );
}
