"use client";

import { useEffect, useRef } from "react";

const pieces = ["coral", "blue", "mint", "amber", "violet"];
const glyphs = ["✳", "◈", "✦", "◎", "✣"];
const sparkles = [
  ["✦", 6, 19, 18], ["✳", 19, 71, 22], ["★", 31, 10, 25], ["✧", 43, 89, 18],
  ["✦", 57, 28, 29], ["✳", 68, 81, 19], ["◆", 79, 13, 17], ["★", 91, 58, 28],
  ["✧", 11, 91, 16], ["✦", 25, 41, 13], ["✳", 75, 48, 13], ["✧", 89, 92, 17],
] as const;

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
  return <><div ref={ref} className="pointer-light" aria-hidden="true" /><div className="spark-field" aria-hidden="true">{sparkles.map(([star, x, y, size], index) => <span key={index} style={{ "--spark": index, "--star-x": `${x}%`, "--star-y": `${y}%`, "--star-size": `${size}px` } as React.CSSProperties}><i>{star}</i></span>)}</div></>;
}
