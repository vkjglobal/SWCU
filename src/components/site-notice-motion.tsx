"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Notice = { message: string; actionText: string | null; actionUrl: string | null };

export function SiteNoticeMotion({ notice }: { notice: Notice }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [hoveredOrFocused, setHoveredOrFocused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [canMove, setCanMove] = useState(false);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      setReducedMotion(query.matches);
      const viewport = viewportRef.current;
      const overflow = viewport ? Math.max(0, viewport.scrollWidth - viewport.clientWidth) : 0;
      setDistance(overflow);
      setCanMove(overflow > 8);
    };
    update();
    query.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      query.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [notice.message]);

  const moving = canMove && !reducedMotion;
  const animationPaused = paused || hoveredOrFocused;
  return <aside className="border-b border-swcu-blue/15 bg-soft-blue-grey" aria-label="Site notice">
    <div className="site-container flex items-center gap-3 py-2 text-sm" onMouseEnter={() => setHoveredOrFocused(true)} onMouseLeave={() => setHoveredOrFocused(false)} onFocusCapture={() => setHoveredOrFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHoveredOrFocused(false); }}>
      <div ref={viewportRef} className="site-notice-viewport min-w-0 flex-1 overflow-hidden">
        <span ref={messageRef} style={{ "--notice-distance": `${distance}px` } as React.CSSProperties} className={`inline-block whitespace-nowrap font-medium text-deep-navy ${moving ? `site-notice-track${animationPaused ? " is-paused" : ""}` : ""}`}>{notice.message}</span>
      </div>
      {notice.actionUrl && <Link href={notice.actionUrl} className="shrink-0 font-bold text-swcu-blue">{notice.actionText || "Learn more"}</Link>}
      {canMove && !reducedMotion && <button type="button" className="shrink-0 rounded border border-deep-navy/20 px-2 py-1 text-xs font-semibold text-deep-navy hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-swcu-blue" aria-pressed={paused} onClick={() => setPaused((value) => !value)}>{paused ? "Play notice" : "Pause notice"}</button>}
    </div>
  </aside>;
}