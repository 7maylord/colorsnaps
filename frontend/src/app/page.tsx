"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "wagmi";
import WalletConnectButton from "@/components/WalletConnectButton";
import { GlassPieces, PointerLight } from "@/components/Visuals";

export default function Home() {
  const { isConnected, status } = useAccount();
  const router = useRouter();
  useEffect(() => { if (status !== "reconnecting" && isConnected) router.replace("/modes" + window.location.search); }, [isConnected, status, router]);
  return <main className="scene entrance" aria-label="ColorSnap entrance">
    <PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><span className="brand">COLOR<span>SNAP</span><i>✳</i></span><span className="eyebrow">A CONFIDENTIAL COLOR GAME · SEPOLIA</span></header>
    <div className="entrance-grid">
      <section className="entrance-copy">
        <div className="tiny-label"><span className="live-dot" /> THE GAME BEGINS IN PRIVATE</div>
        <h1>Remember<br /><em>the light.</em><br />Reveal your<br />instinct.</h1>
        <p>A five-piece memory game where the pattern stays yours. Pick a mode, hold the colors in your mind, and let confidential computation settle the score.</p>
        <div className="entry-actions"><WalletConnectButton play /></div>
        <div className="entry-foot">Choose wallet or email in the sign-in window. Then pick your mode and jump in.</div>
      </section>
      <div className="prism-stage" aria-label="Five glass colors"><div className="stage-ring ring-one" /><div className="stage-ring ring-two" /><div className="stage-sparkles" aria-hidden="true"><span>✦</span><span>✳</span><span>★</span><span>✧</span><span>✦</span></div><GlassPieces /></div>
    </div>
    <footer className="site-foot"><span>01 / 04 · CHOOSE YOUR MODE</span><span>POWERED BY ZAMA FHE</span></footer>
  </main>;
}
