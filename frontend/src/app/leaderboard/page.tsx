"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";
import { colorSnapArcadeAbi, colorSnapPlayerRegistryAbi, SEPOLIA_CHAIN_ID, SEPOLIA_CONTRACTS } from "@/contracts";
import { PointerLight } from "@/components/Visuals";
import WalletConnectButton from "@/components/WalletConnectButton";
import { errorText, notify } from "@/lib/notifications";

type RankedPlayer = { player: Address; points: bigint; completedGames: bigint; name: string };
const PAGE_SIZE = BigInt(25);

export default function LeaderboardPage() {
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (offset: bigint) => {
    if (!publicClient) { notify("error", "Sepolia RPC is unavailable."); setFailed(true); setLoading(false); return; }
    setLoading(true);
    setFailed(false);
    try {
      const entries = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.arcade, abi: colorSnapArcadeAbi, functionName: "getLeaderboard", args: [offset, PAGE_SIZE] }) as { player: Address; points: bigint; completedGames: bigint }[];
      const ranked = await Promise.all(entries.map(async entry => {
        let name = "";
        try { name = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.playerRegistry, abi: colorSnapPlayerRegistryAbi, functionName: "names", args: [entry.player] }) as string; }
        catch { /* Wallet address is a stable fallback. */ }
        return { ...entry, name };
      }));
      setPlayers(previous => offset === BigInt(0) ? ranked : [...previous, ...ranked]);
      setHasMore(entries.length === Number(PAGE_SIZE));
    } catch (cause) {
      setFailed(true);
      notify("error", errorText(cause, "Could not load the leaderboard."));
    } finally { setLoading(false); }
  }, [publicClient]);

  useEffect(() => { void load(BigInt(0)); }, [load]);

  return <main className="scene leaderboard-scene"><PointerLight /><div className="noise" aria-hidden="true" />
    <header className="site-head"><Link href="/modes" className="brand">COLOR<span>SNAP</span><i>✳</i></Link><WalletConnectButton /></header>
    <div className="leaderboard-shell">
      <span className="tiny-label"><span className="live-dot" /> SEPOLIA · ARCADE SCORES</span>
      <h1>The <em>snapboard.</em></h1>
      <p>Every verified Classic win earns 10 points. Every verified Daily win earns 20 points after claiming. Your on-chain callsign follows your wallet.</p>
      <div className="leaderboard-board">
        {players.length === 0 && !loading && !failed && <div className="leaderboard-empty">No players yet. Play Classic or Daily to enter the board.</div>}
        {failed && <div className="leaderboard-error">Could not load scores. <button onClick={() => void load(BigInt(0))}>Try again</button></div>}
        {players.map((entry, index) => <div className="leaderboard-row" key={entry.player}>
          <span className="leaderboard-position">{index === 0 ? "★" : String(index + 1).padStart(2, "0")}</span>
          <span className="leaderboard-player"><strong>{entry.name || `${entry.player.slice(0, 6)}…${entry.player.slice(-4)}`}</strong><small>{entry.player.slice(0, 6)}…{entry.player.slice(-4)} · {entry.completedGames.toString()} Classic games</small></span>
          <span className="leaderboard-time">{entry.points.toString()} PTS</span>
        </div>)}
        {loading && <div className="leaderboard-loading" aria-label="Loading the board" />}
      </div>
      <div className="leaderboard-actions">{hasMore && !loading && <button onClick={() => void load(BigInt(players.length))}>Show more players ↘</button>}<Link href="/game">Play Classic →</Link><Link href="/daily">Play Daily →</Link><Link href="/modes">All modes ↗</Link></div>
    </div>
  </main>;
}
