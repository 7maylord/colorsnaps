"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { CHAIN_IDS } from "@/config/chains";
import WalletConnectButton from "./WalletConnectButton";
import { PointerLight } from "./Visuals";

export const GLASS = [
  { name: "Coral", glyph: "✳", color: "coral" },
  { name: "Blue", glyph: "◈", color: "blue" },
  { name: "Mint", glyph: "✦", color: "mint" },
  { name: "Amber", glyph: "◎", color: "amber" },
  { name: "Violet", glyph: "✣", color: "violet" },
];

export function PlayFrame({ mode, number, description, children }: { mode: string; number: string; description: string; children: React.ReactNode }) {
  const { isConnected, status } = useAccount();
  const router = useRouter();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  useEffect(() => { if (status === "disconnected") router.replace("/" + window.location.search); }, [status, router]);
  return <main className="scene play-scene"><PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><Link href="/modes" className="brand">COLOR<span>SNAP</span><i>✳</i></Link><WalletConnectButton /></header>
    <nav className="play-nav"><Link href="/modes">← ALL MODES</Link><span>{number} / 04</span></nav>
    <div className="play-heading"><div><span className="tiny-label"><span className="live-dot" /> CONFIDENTIAL / {mode.toUpperCase()}</span><h1 className="play-title"><em>{mode}</em> room.</h1></div><p>{description}</p></div>
    {status === "reconnecting" ? <div className="game-notice">Restoring your session…</div> : !isConnected ? <div className="game-notice">Sign in to play. <Link href={typeof window !== "undefined" ? "/" + window.location.search : "/"}>Go to entrance →</Link></div> : chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA ? <div className="game-notice">This room plays on Ethereum Sepolia. <button className="text-action" onClick={() => switchChain({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA })}>Switch network</button></div> : children}
    <footer className="site-foot"><span>PRIVATE PATTERN · PUBLIC PROOF</span><span>BUILT WITH ZAMA FHE</span></footer>
  </main>;
}

export function ColorBoard({ pieces, selected, reveal, onChoose }: { pieces: readonly number[]; selected?: number; reveal?: boolean; onChoose?: (index: number) => void }) {
  return <div className={`color-board ${reveal ? "is-reveal" : ""}`} role="group" aria-label={reveal ? "Private pattern to memorize" : "Arrange five colored pieces"}>
    {pieces.map((color, index) => { const piece = GLASS[color]; return <button key={index} type="button" className={`board-piece ${piece.color} ${selected === index ? "selected" : ""}`} onClick={() => onChoose?.(index)} disabled={!onChoose} aria-label={`${piece.name}, position ${index + 1}${selected === index ? ", selected" : ""}`} aria-pressed={selected === index}><span>{piece.glyph}</span><small>{piece.name}</small></button>; })}
  </div>;
}
