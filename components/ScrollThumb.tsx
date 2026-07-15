"use client";

import { useEffect, useState, type RefObject } from "react";

const THUMB_SIZE = 7;

interface Props {
  // The clipped, overflow-y-auto box - its clientHeight/scrollTop drive the
  // thumb's travel range and position.
  containerRef: RefObject<HTMLDivElement | null>;
  // The content actually being scrolled - watched separately because its
  // height (not the fixed-size container's) is what changes when the
  // panel's content swaps to a different node.
  contentRef: RefObject<HTMLDivElement | null>;
}

// A vertical line with a single round node riding on it - same track/thumb
// language as .range-thin (1px line, 7px rgba(255,255,255,0.25) dot), used
// instead of a native scrollbar because no browser lets a
// ::-webkit-scrollbar-thumb stay pinned to a fixed dot size; it always
// stretches to represent the scroll ratio instead of staying one node.
export default function ScrollThumb({ containerRef, contentRef }: Props) {
  const [state, setState] = useState({ visible: false, top: 0 });

  useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    function update() {
      const el = containerRef.current;
      if (!el) return;
      const maxScroll = el.scrollHeight - el.clientHeight;
      const visible = maxScroll > 1;
      const trackHeight = Math.max(0, el.clientHeight - THUMB_SIZE);
      const top = visible ? (el.scrollTop / maxScroll) * trackHeight : 0;
      setState({ visible, top });
    }

    update();
    container.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(content);
    return () => {
      container.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [containerRef, contentRef]);

  function handlePointerDown(e: React.PointerEvent) {
    const el = containerRef.current;
    if (!el) return;
    e.preventDefault();
    const startY = e.clientY;
    const startScrollTop = el.scrollTop;
    const maxScroll = el.scrollHeight - el.clientHeight;
    const trackHeight = el.clientHeight - THUMB_SIZE;

    function onMove(ev: PointerEvent) {
      if (trackHeight <= 0) return;
      const deltaScroll = ((ev.clientY - startY) / trackHeight) * maxScroll;
      el!.scrollTop = Math.min(maxScroll, Math.max(0, startScrollTop + deltaScroll));
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!state.visible) return null;

  return (
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-[7px]">
      <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
      <div
        onPointerDown={handlePointerDown}
        className="pointer-events-auto absolute left-1/2 h-[7px] w-[7px] -translate-x-1/2 cursor-pointer rounded-full bg-[#ede6da] hover:bg-white"
        style={{ top: state.top }}
      />
    </div>
  );
}
