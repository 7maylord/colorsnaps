"use client";

import { useEffect, useRef } from "react";

const pieces = ["coral", "blue", "mint", "amber", "violet"];
const glyphs = ["✳", "◈", "✦", "◎", "✣"];

export function GlassPieces({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? "glass-pieces compact" : "glass-pieces"} aria-hidden="true">{pieces.map((piece, index) => <div key={piece} className={`glass-piece ${piece}`} style={{ "--i": index } as React.CSSProperties}><span>{glyphs[index]}</span></div>)}</div>;
}

export function PointerLight() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (!ref.current) return;
        ref.current.style.setProperty("--x", `${event.clientX}px`);
        ref.current.style.setProperty("--y", `${event.clientY}px`);
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener("pointermove", move); };
  }, []);
  return <><div ref={ref} className="pointer-light" aria-hidden="true" /><div className="spark-field" aria-hidden="true">{["✦", "✳", "◆", "✦", "★", "✧", "✳", "✦"].map((star, index) => <span key={index} style={{ "--spark": index } as React.CSSProperties}>{star}</span>)}</div></>;
}
