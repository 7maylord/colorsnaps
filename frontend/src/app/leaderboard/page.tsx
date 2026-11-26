"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { colorSnapDailyAbi, colorSnapPlayerRegistryAbi, SEPOLIA_CHAIN_ID, SEPOLIA_CONTRACTS } from "@/contracts";
import { PointerLight } from "@/components/Visuals";
import WalletConnectButton from "@/components/WalletConnectButton";

type RankedPlayer = { player: Address; submittedAt: bigint; name: string };
const PAGE_SIZE = BigInt(25);

export default function LeaderboardPage() {
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const [day, setDay] = useState<bigint>();
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (offset: bigint) => {
    if (!publicClient) { setError("Sepolia RPC is unavailable."); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const currentDay = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.daily, abi: colorSnapDailyAbi, functionName: "currentDay" }) as bigint;
      const entries = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.daily, abi: colorSnapDailyAbi, functionName: "getLeaderboard", args: [currentDay, offset, PAGE_SIZE] }) as { player: Address; submittedAt: bigint }[];
      const ranked = await Promise.all(entries.map(async entry => {
        let name = "";
        if (SEPOLIA_CONTRACTS.playerRegistry) {
          try { name = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.playerRegistry, abi: colorSnapPlayerRegistryAbi, functionName: "names", args: [entry.player] }) as string; }
          catch { /* Address remains a stable fallback. */ }
        }
        return { ...entry, name };
      }));
      setDay(currentDay);
      setPlayers(previous => offset === BigInt(0) ? ranked : [...previous, ...ranked]);
      setHasMore(entries.length === Number(PAGE_SIZE));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load today's standings.");
    } finally { setLoading(false); }
  }, [publicClient]);

  useEffect(() => { void load(BigInt(0)); }, [load]);

  return <main className="scene leaderboard-scene"><PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><Link href="/modes" className="brand">COLOR<span>SNAP</span><i>✳</i></Link><WalletConnectButton /></header>
    <div className="leaderboard-shell">
      <span className="tiny-label"><span className="live-dot" /> SEPOLIA · DAILY CHALLENGE</span>
      <h1>Today&apos;s <em>top snaps.</em></h1>
      <p>Proof-verified solves, ranked by submission time. Names are public callsigns owned by each wallet. UTC day {day?.toString() ?? "…"}.</p>
      <div className="leaderboard-board">
        {players.length === 0 && !loading && !error && <div className="leaderboard-empty">No verified wins yet. Be the first to snap today&apos;s pattern.</div>}
        {players.map((entry, index) => <div className="leaderboard-row" key={entry.player}>
          <span className="leaderboard-position">{index === 0 ? "★" : String(index + 1).padStart(2, "0")}</span>
          <span className="leaderboard-player"><strong>{entry.name || `${entry.player.slice(0, 6)}…${entry.player.slice(-4)}`}</strong><small>{entry.player.slice(0, 6)}…{entry.player.slice(-4)}</small></span>
          <span className="leaderboard-time">{new Date(Number(entry.submittedAt) * 1000).toLocaleTimeString("en-GB", { timeZone: "UTC" })} UTC</span>
        </div>)}
        {error && <p role="alert" className="leaderboard-error">{error}</p>}
        {loading && <p role="status" className="leaderboard-empty">Loading the board…</p>}
      </div>
      <div className="leaderboard-actions">{hasMore && !loading && <button onClick={() => void load(BigInt(players.length))}>Show more players ↘</button>}<Link href="/daily">Play today&apos;s puzzle →</Link><Link href="/modes">All modes ↗</Link></div>
    </div>
  </main>;
}
