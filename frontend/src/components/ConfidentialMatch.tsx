"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { decodeEventLog, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { colorSnapArcadeAbi, colorSnapChallengeArtifactAbi, colorSnapDailyAbi, SEPOLIA_CHAIN_ID, SEPOLIA_CONTRACTS } from "@/contracts";
import { decryptClassicValues, decryptPublicBooleanWithProof, encryptClassicSolution } from "@/lib/zama/classic-fhe";
import { ColorBoard, PlayFrame } from "./PlayFrame";
import { errorText, notify, useMessageToast } from "@/lib/notifications";

const INITIAL = [0, 1, 2, 3, 4];
type MatchMode = "daily" | "challenge";
type Phase = "ready" | "joining" | "waiting" | "revealing" | "playing" | "submitted" | "finalizing" | "resolved" | "error";
type Challenge = readonly [Address, Address, number, bigint, bigint, Address, boolean, boolean];
type DailyResult = readonly [boolean, boolean, boolean, boolean, bigint];

export default function ConfidentialMatch({ mode }: { mode: MatchMode }) {
  const isDaily = mode === "daily";
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const router = useRouter();
  const params = useSearchParams();
  const contractAddress = isDaily ? SEPOLIA_CONTRACTS.daily : SEPOLIA_CONTRACTS.challenge;
  const abi = isDaily ? colorSnapDailyAbi : colorSnapChallengeArtifactAbi;
  const [id, setId] = useState<bigint>();
  const [inputId, setInputId] = useState("");
  const [phase, setPhase] = useState<Phase>("ready");
  const [message, setMessage] = useState(isDaily ? "Join today's shared puzzle." : "Create a link or enter an invite code.");
  useMessageToast(message, phase);
  const [challenge, setChallenge] = useState<Challenge>();
  const [dailyResult, setDailyResult] = useState<DailyResult>();
  const [dailyClaimed, setDailyClaimed] = useState(false);
  const [pieces, setPieces] = useState<number[]>(INITIAL);
  const [target, setTarget] = useState<number[]>([]);
  const [selected, setSelected] = useState<number>();
  const [busy, setBusy] = useState(false);
  const key = address ? `colorsnap:${mode}:${SEPOLIA_CHAIN_ID}:${contractAddress.toLowerCase()}:${address.toLowerCase()}` : "";

  const refresh = useCallback(async (matchId: bigint) => {
    if (!publicClient || !address) return;
    if (isDaily) {
      const [result, claimed] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi, functionName: "getPlayerResult", args: [matchId, address] }) as Promise<DailyResult>,
        publicClient.readContract({ address: SEPOLIA_CONTRACTS.arcade, abi: colorSnapArcadeAbi, functionName: "dailyClaimed", args: [matchId, address] }) as Promise<boolean>,
      ]);
      setDailyResult(result); setDailyClaimed(claimed);
      if (result[2]) { setPhase("resolved"); setMessage(result[3] ? claimed ? "Verified. Your 20 points are on the leaderboard." : "Verified win. Claim your 20 points." : "Verified. Tomorrow brings a new pattern."); }
      else if (result[1]) { setPhase("submitted"); setMessage("Your answer is on chain. Verify the public result to enter the ranking."); }
      else if (result[0]) { setPhase("waiting"); setMessage("You're in. Reveal today's private pattern when ready."); }
      else { setPhase("ready"); setMessage("Join today's shared puzzle."); }
    } else {
      const state = await publicClient.readContract({ address: contractAddress, abi, functionName: "getChallenge", args: [matchId] }) as Challenge;
      setChallenge(state);
      if (state[2] === 3) { setPhase("resolved"); setMessage(state[5] === "0x0000000000000000000000000000000000000000" ? "Draw. Neither player verified a win." : `Winner: ${state[5]}`); }
      else if (state[2] === 4) { setPhase("resolved"); setMessage("This challenge was cancelled."); }
      else if (state[2] === 1) { setPhase("waiting"); setMessage("Invite a friend. The five minute clock starts when they join."); }
      else if (state[2] === 2) {
        const mine = state[0].toLowerCase() === address.toLowerCase() ? state[6] : state[7];
        setPhase(mine ? "submitted" : "waiting");
        setMessage(mine ? "Your solution is on chain. Verify its public result." : "The challenge is live. Reveal the private pattern.");
      } else { setPhase("error"); setMessage("Challenge does not exist."); }
    }
  }, [publicClient, address, isDaily, contractAddress, abi]);

  useEffect(() => {
    if (!address || !publicClient) return;
    let cancelled = false;
    (async () => {
      try {
        if (isDaily) {
          const day = await publicClient.readContract({ address: contractAddress, abi, functionName: "currentDay" }) as bigint;
          if (cancelled) return;
          setId(day); await refresh(day);
        } else {
          const invite = params.get("invite");
          const saved = key && localStorage.getItem(key);
          const value = invite || saved;
          if (value && /^\d+$/.test(value)) { const challengeId = BigInt(value); if (!cancelled) { setId(challengeId); await refresh(challengeId); } }
        }
      } catch (error) { if (!cancelled) { setPhase("error"); notify("error", errorText(error, "Could not load the match.")); } }
    })();
    return () => { cancelled = true; setTarget([]); setPieces(INITIAL); setSelected(undefined); };
  }, [address, publicClient, isDaily, contractAddress, abi, refresh, params, key]);

  useEffect(() => {
    if (phase !== "revealing" || target.length !== 5) return;
    const timer = setTimeout(() => { setTarget([]); setPhase("playing"); setMessage("Select two pieces to swap them. Submit your arrangement before the deadline."); }, 3000);
    return () => clearTimeout(timer);
  }, [phase, target]);

  async function transaction(functionName: string, args: readonly unknown[] = []) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable.");
    const hash = await writeContractAsync({ address: contractAddress, abi, functionName, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted.");
    return receipt;
  }

  async function action(work: () => Promise<void>) {
    setBusy(true);
    try { await work(); } catch (error) { setPhase("error"); notify("error", errorText(error, "The action failed.")); }
    finally { setBusy(false); }
  }

  function choose(index: number) {
    if (phase !== "playing") return;
    if (selected === undefined) { setSelected(index); return; }
    if (selected === index) { setSelected(undefined); return; }
    setPieces(current => { const next = [...current]; [next[selected], next[index]] = [next[index], next[selected]]; return next; }); setSelected(undefined);
  }

  async function start() { await action(async () => {
    setPhase("joining"); setMessage("Approve this Sepolia transaction in your wallet.");
    if (isDaily) {
      if (!id || !publicClient) return;
      const today = await publicClient.readContract({ address: contractAddress, abi, functionName: "getDailyChallenge", args: [id] }) as readonly [boolean,bigint,bigint];
      if (!today[0]) await transaction("createToday");
      await transaction("joinToday"); await refresh(id);
    } else {
      const receipt = await transaction("createChallenge");
      const event = receipt.logs.map(log => { try { return decodeEventLog({ abi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(log => log?.eventName === "ChallengeCreated");
      if (!event || event.eventName !== "ChallengeCreated") throw new Error("Challenge ID was not emitted.");
      const matchId = (event.args as unknown as { challengeId: bigint }).challengeId;
      setId(matchId); if (key) localStorage.setItem(key, matchId.toString()); router.replace(`/challenge?invite=${matchId}`); await refresh(matchId);
    }
  }); }

  async function join(value = inputId) { await action(async () => {
    if (!/^\d+$/.test(value)) throw new Error("Enter a numeric challenge ID.");
    const matchId = BigInt(value); setPhase("joining"); setMessage("Approve joining your friend's challenge.");
    await transaction("joinChallenge", [matchId]); setId(matchId); if (key) localStorage.setItem(key, matchId.toString()); router.replace(`/challenge?invite=${matchId}`); await refresh(matchId);
  }); }

  async function reveal() { await action(async () => {
    if (id === undefined || !address || !publicClient || !walletClient) return;
    setPhase("revealing"); setMessage("Approve the private pattern reveal in your wallet.");
    const ciphertexts = await publicClient.readContract({ address: contractAddress, abi, functionName: "getPuzzleCiphertexts", args: [id], account: address }) as readonly Hex[];
    const values = await decryptClassicValues({ publicClient, walletClient, playerAddress: address, contractAddress, ciphertexts });
    setTarget([...values]); setPieces(INITIAL); setMessage("Memorize the pattern. Three seconds.");
  }); }

  async function submit() { await action(async () => {
    if (id === undefined || !address || !publicClient) return;
    setPhase("joining"); setMessage("Encrypting and submitting your private arrangement…");
    const encrypted = await encryptClassicSolution({ publicClient, contractAddress, playerAddress: address, bottleIds: pieces });
    await transaction("submitSolution", [id, encrypted.handles, encrypted.inputProof]); await refresh(id);
  }); }

  async function finalize() { await action(async () => {
    if (id === undefined || !address || !publicClient) return;
    setPhase("finalizing"); setMessage("Fetching the Zama KMS proof for your public win/loss boolean…");
    const ciphertext = await publicClient.readContract({ address: contractAddress, abi, functionName: "getPublicResultCiphertext", args: [id, address] }) as Hex;
    const proof = await decryptPublicBooleanWithProof({ publicClient, ciphertext });
    setMessage("Approve the proof verification transaction.");
    await transaction("finalizeResult", [id, address, [...proof.cleartexts], proof.decryptionProof]);
    if (isDaily && proof.solved) await claimDailyPoints(id);
    await refresh(id);
  }); }

  async function claimDailyPoints(day: bigint) {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable.");
    setMessage("Approve the 20 point Daily claim in your wallet.");
    const hash = await writeContractAsync({ address: SEPOLIA_CONTRACTS.arcade, abi: colorSnapArcadeAbi, functionName: "claimDaily", args: [day], chainId: SEPOLIA_CHAIN_ID });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Daily points claim reverted.");
    notify("success", "+20 Daily points! Check the leaderboard.");
  }

  async function claimDaily() { await action(async () => { if (id === undefined) return; await claimDailyPoints(id); await refresh(id); }); }

  async function resolve() { await action(async () => { if (id === undefined) return; await transaction("resolveChallenge", [id]); await refresh(id); }); }
  async function cancel() { await action(async () => { if (id === undefined) return; await transaction("cancelChallenge", [id]); await refresh(id); }); }
  const mine = challenge && address ? challenge[0].toLowerCase() === address.toLowerCase() ? challenge[6] : challenge[7] : false;
  const mayPlay = isDaily ? dailyResult?.[0] && !dailyResult[1] : challenge?.[2] === 2 && !mine && (challenge[0].toLowerCase() === address?.toLowerCase() || challenge[1].toLowerCase() === address?.toLowerCase()) && BigInt(Math.floor(Date.now() / 1000)) <= challenge[3];
  const inviteUrl = typeof window !== "undefined" && id ? `${location.origin}/challenge?invite=${id}` : "";

  return <PlayFrame mode={isDaily ? "Daily" : "Challenge"} number={isDaily ? "02" : "03"} description={isDaily ? "One shared secret each UTC day. One attempt to join the board." : "Two players, one secret. Invite a friend, then race the five minute clock."}>
    <section className="game-panel"><div className="board-side"><div className="board-top"><span>{isDaily ? `UTC DAY ${id ?? "…"}` : `INVITE ${id ?? "NEW"}`}</span><span>{phase === "revealing" ? "PRIVATE REVEAL" : "COLOR WORKBENCH"}</span></div><div className="board-surface"><ColorBoard pieces={phase === "revealing" && target.length === 5 ? target : pieces} selected={selected} reveal={phase === "revealing"} onChoose={phase === "playing" ? choose : undefined} /><div className="board-hint">{phase === "playing" ? "Select two pieces to swap." : "A secret pattern, visible only to its players."}</div></div><div className="board-top"><span>✳ CORAL · ◈ BLUE · ✦ MINT · ◎ AMBER · ✣ VIOLET</span></div></div>
      <div className="control-side"><div className="control-top"><span>{isDaily ? "TODAY'S PANE" : "TWO PLAYER RACK"}</span><span>{phase.toUpperCase()}</span></div><div className="control-main"><span className="step-tag">{isDaily ? new Date().toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" }).toUpperCase() : challenge?.[2] === 2 ? "LIVE" : "INVITE"}</span><h2>{isDaily ? "Leave your mark." : "Play together."}</h2>
        {isDaily && phase === "ready" && <button disabled={busy} className="primary-action control-action" onClick={start}>Join today's puzzle →</button>}
        {!isDaily && !id && <><button disabled={busy} className="primary-action control-action" onClick={start}>Create challenge →</button><input className="field" inputMode="numeric" placeholder="Or enter invite ID" value={inputId} onChange={event => setInputId(event.target.value)} /><button disabled={busy || !inputId} className="text-action" onClick={() => join()}>Join invite →</button></>}
        {!isDaily && id && challenge?.[2] === 1 && <><span className="invite-link">{inviteUrl}</span><div className="sub-actions"><button onClick={() => navigator.clipboard.writeText(inviteUrl)}>Copy invite</button>{challenge[0].toLowerCase() !== address?.toLowerCase() && <button disabled={busy} onClick={() => join(id.toString())}>Join challenge</button>}{challenge[0].toLowerCase() === address?.toLowerCase() && <button disabled={busy} onClick={cancel}>Cancel</button>}<button onClick={() => refresh(id)}>Refresh</button></div></>}
        {mayPlay && phase === "waiting" && <button disabled={busy} className="primary-action control-action" onClick={reveal}>Reveal pattern →</button>}
        {phase === "playing" && <button disabled={busy} className="primary-action control-action" onClick={submit}>Submit arrangement →</button>}
        {phase === "submitted" && <button disabled={busy} className="primary-action control-action" onClick={finalize}>Verify result →</button>}
        {isDaily && phase === "resolved" && dailyResult?.[3] && !dailyClaimed && <button disabled={busy} className="primary-action control-action" onClick={claimDaily}>Claim 20 points →</button>}
        {!isDaily && id && challenge?.[2] === 2 && <div className="sub-actions"><button disabled={busy} onClick={resolve}>Resolve if ready</button><button onClick={() => refresh(id)}>Refresh</button></div>}
        {phase === "error" && id && <button className="text-action" onClick={() => refresh(id)}>Refresh state</button>}
      </div><div className="status-line">{isDaily ? "One verified result per UTC day" : challenge?.[2] === 2 ? `Deadline: ${new Date(Number(challenge[3])*1000).toLocaleTimeString()} · Creator ${challenge[6] ? "submitted" : "waiting"} · Friend ${challenge[7] ? "submitted" : "waiting"}` : "A challenge begins when the second player joins"}</div></div>
    </section>
  </PlayFrame>;
}
