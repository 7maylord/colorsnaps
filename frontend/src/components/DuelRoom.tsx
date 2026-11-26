"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, encodeAbiParameters, isAddress, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { colorSnapDuelAbi, colorSnapDuelEscrowAbi, colorSnapTestTokenAbi, SEPOLIA_CHAIN_ID, SEPOLIA_CONTRACTS } from "@/contracts";
import { decryptClassicValues, decryptPublicBooleanWithProof, encryptClassicSolution, encryptStake } from "@/lib/zama/classic-fhe";
import { ColorBoard, PlayFrame } from "./PlayFrame";
import { notify, errorText, useMessageToast } from "@/lib/notifications";

type EscrowState = readonly [Address, Address, number, boolean, boolean];
const INITIAL = [0, 1, 2, 3, 4];
const PUBLIC_MINT_ABI = [{
  type: "function", name: "$_mint", stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint64" }],
  outputs: [{ name: "transferred", type: "bytes32" }],
}] as const;

export default function DuelRoom() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { data: walletClient } = useWalletClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [id, setId] = useState<bigint>();
  const [inputId, setInputId] = useState("");
  const [opponent, setOpponent] = useState("");
  const [state, setState] = useState<EscrowState>();
  const [stake, setStake] = useState<bigint>();
  const [decimals, setDecimals] = useState<number>();
  const [gasBalance, setGasBalance] = useState<bigint>();
  const [recovery, setRecovery] = useState(false);
  const [started, setStarted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pieces, setPieces] = useState<number[]>(INITIAL);
  const [target, setTarget] = useState<number[]>([]);
  const [selected, setSelected] = useState<number>();
  const [phase, setPhase] = useState("ready");
  const [message, setMessage] = useState("Enter an opponent address, or open an existing duel.");
  useMessageToast(message, phase);
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState(false);
  const key = address ? `colorsnap:duel:${SEPOLIA_CHAIN_ID}:${SEPOLIA_CONTRACTS.duelEscrow.toLowerCase()}:${address.toLowerCase()}` : "";
  const mine = state && address ? state[0].toLowerCase() === address.toLowerCase() ? 0 : state[1].toLowerCase() === address.toLowerCase() ? 1 : -1 : -1;

  const refresh = useCallback(async (duelId: bigint) => {
    if (!publicClient || !address) return;
    const [duel, deadline] = await Promise.all([
      publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: colorSnapDuelEscrowAbi, functionName: "getDuel", args: [duelId] }) as Promise<EscrowState>,
      publicClient.readContract({ address: SEPOLIA_CONTRACTS.duel, abi: colorSnapDuelAbi, functionName: "verificationDeadline", args: [duelId] }) as Promise<bigint>,
    ]);
    setState(duel); setStarted(deadline > BigInt(0));
    if (deadline > BigInt(0)) {
      try { await publicClient.readContract({ address: SEPOLIA_CONTRACTS.duel, abi: colorSnapDuelAbi, functionName: "getPublicResultCiphertext", args: [duelId, address] }); setSubmitted(true); }
      catch { setSubmitted(false); }
    }
    if (duel[2] === 4) { setPhase("settled"); setMessage("Escrow has settled. The verified winner received the stake, or each player received a draw refund."); }
    else if (duel[2] === 5) { setPhase("cancelled"); setMessage("The funding window expired and pending deposits were returned."); }
    else if (deadline > BigInt(0)) { setPhase("active"); setMessage("The confidential referee is ready. Reveal and arrange the shared pattern."); }
    else if (duel[2] === 3) { setPhase("funded"); setMessage("Both deposits are verified. Start the duel."); }
    else { setPhase("funding"); setMessage(duel[2] === 1 ? "The creator deposits first." : "Creator funded. The opponent can now deposit."); }
  }, [publicClient, address]);

  useEffect(() => {
    if (!address || !publicClient) return;
    setRecovery(false);
    setMinted(false);
    let cancelled = false;
    (async () => {
      try {
        const [amount, units, tokenAddress, refereeAddress, ethBalance] = await Promise.all([
          publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: colorSnapDuelEscrowAbi, functionName: "stake" }) as Promise<bigint>,
          publicClient.readContract({ address: SEPOLIA_CONTRACTS.testToken, abi: colorSnapTestTokenAbi, functionName: "decimals" }) as Promise<number>,
          publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: colorSnapDuelEscrowAbi, functionName: "token" }) as Promise<Address>,
          publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: colorSnapDuelEscrowAbi, functionName: "referee" }) as Promise<Address>,
          publicClient.getBalance({ address }),
        ]);
        if (cancelled) return;
        setStake(amount); setDecimals(units); setGasBalance(ethBalance);
        if (tokenAddress.toLowerCase() !== SEPOLIA_CONTRACTS.testToken.toLowerCase() || refereeAddress.toLowerCase() !== SEPOLIA_CONTRACTS.duel.toLowerCase()) throw new Error("Escrow token or referee does not match the configured deployment.");
        try { const timeout = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: [{ type: "function", name: "FUNDING_TIMEOUT", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] }] as const, functionName: "FUNDING_TIMEOUT" }); setRecovery(timeout > BigInt(0)); if (timeout === BigInt(0)) notify("warning", "Duel deposits are disabled because funding recovery is unavailable."); }
        catch { setRecovery(false); notify("warning", "Duel deposits are disabled because funding recovery could not be checked."); }
        const saved = key && localStorage.getItem(key);
        const query = new URLSearchParams(location.search).get("duel");
        const value = query || saved;
        if (value && /^\d+$/.test(value)) { const duelId = BigInt(value); setId(duelId); await refresh(duelId); }
      } catch (error) { if (!cancelled) notify("error", errorText(error, "Cannot load escrow configuration.")); }
    })();
    return () => { cancelled = true; setTarget([]); setPieces(INITIAL); setSelected(undefined); };
  }, [address, publicClient, key, refresh]);

  useEffect(() => { if (gasBalance === BigInt(0)) notify("warning", "Add Sepolia ETH for transaction gas before playing."); }, [gasBalance]);

  useEffect(() => { if (phase !== "revealing" || target.length !== 5) return; const timer = setTimeout(() => { setTarget([]); setPhase("playing"); setMessage("Swap pairs until you can recall the shared pattern."); }, 3000); return () => clearTimeout(timer); }, [phase, target]);

  async function send(contract: "escrow" | "referee" | "token", functionName: string, args: readonly unknown[] = []) {
    if (!publicClient) throw new Error("Sepolia RPC unavailable.");
    const address = contract === "escrow" ? SEPOLIA_CONTRACTS.duelEscrow : contract === "referee" ? SEPOLIA_CONTRACTS.duel : SEPOLIA_CONTRACTS.testToken;
    const abi = contract === "escrow" ? colorSnapDuelEscrowAbi : contract === "referee" ? colorSnapDuelAbi : colorSnapTestTokenAbi;
    const hash = await writeContractAsync({ address, abi, functionName, args });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Transaction reverted.");
    return receipt;
  }
  async function run(work: () => Promise<void>) { const priorPhase = phase; setBusy(true); try { await work(); } catch (error) { setPhase(priorPhase); notify("error", errorText(error, "The action failed.")); } finally { setBusy(false); } }
  function choose(index: number) { if (phase !== "playing") return; if (selected === undefined) { setSelected(index); return; } if (selected === index) { setSelected(undefined); return; } setPieces(current => { const next = [...current]; [next[selected], next[index]] = [next[index], next[selected]]; return next; }); setSelected(undefined); }

  async function create() { await run(async () => {
    if (!isAddress(opponent)) throw new Error("Enter a valid opponent address.");
    if (!recovery) throw new Error("This escrow lacks timeout recovery. Funding is disabled until the updated contract is deployed.");
    setMessage("Approve duel creation.");
    const receipt = await send("escrow", "createDuel", [opponent]);
    const event = receipt.logs.map(log => { try { return decodeEventLog({ abi: colorSnapDuelEscrowAbi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(log => log?.eventName === "DuelCreated");
    if (!event || event.eventName !== "DuelCreated") throw new Error("Duel ID was not emitted.");
    const duelId = (event.args as unknown as { duelId: bigint }).duelId;
    setId(duelId); if (key) localStorage.setItem(key, duelId.toString()); history.replaceState(null, "", `/duel?duel=${duelId}`); await refresh(duelId);
  }); }
  async function open() { if (!/^\d+$/.test(inputId)) { notify("error", "Enter a numeric duel ID."); return; } await run(async () => { const duelId = BigInt(inputId); await refresh(duelId); setId(duelId); if (key) localStorage.setItem(key, duelId.toString()); history.replaceState(null, "", `/duel?duel=${duelId}`); }); }
  async function mint() { await run(async () => {
    if (!address || stake === undefined || !publicClient) throw new Error("Connect on Sepolia and wait for the stake amount to load.");
    const amount = stake * BigInt(2);
    if (amount > BigInt("18446744073709551615")) throw new Error("The test mint amount exceeds the token limit.");
    setMessage("Approve the public test cUSD mint in your wallet.");
    const hash = await writeContractAsync({ address: SEPOLIA_CONTRACTS.testToken, abi: PUBLIC_MINT_ABI, functionName: "$_mint", args: [address, amount], chainId: SEPOLIA_CHAIN_ID });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("Test cUSD mint reverted.");
    setMinted(true);
    setMessage("Test cUSD minted to your wallet. You can now fund a duel.");
  }); }
  async function deposit() { await run(async () => {
    if (!recovery) throw new Error("Timeout recovery is not available on this deployed escrow.");
    if (!id || !address || !publicClient || stake === undefined) return;
    setMessage("Encrypting the exact stake for the test token…");
    const encrypted = await encryptStake({ publicClient, tokenAddress: SEPOLIA_CONTRACTS.testToken, playerAddress: address, amount: stake });
    setMessage("Approve the confidential transfer and wait for confirmation.");
    await send("token", "confidentialTransferAndCall", [SEPOLIA_CONTRACTS.duelEscrow, encrypted.handle, encrypted.inputProof, encodeAbiParameters([{ type: "uint256" }], [id])]);
    await refresh(id); setMessage("Deposit received. Verify the encrypted amount next.");
  }); }
  async function verifyDeposit() { await run(async () => {
    if (!id || !address || !publicClient) return;
    setMessage("Fetching the deposit match proof from Zama KMS…");
    const ciphertext = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.duelEscrow, abi: colorSnapDuelEscrowAbi, functionName: "getDepositMatchCiphertext", args: [id, address] }) as Hex;
    const proof = await decryptPublicBooleanWithProof({ publicClient, ciphertext });
    setMessage("Approve the on-chain deposit verification."); await send("escrow", "finalizeDeposit", [id, address, [...proof.cleartexts], proof.decryptionProof]); await refresh(id);
  }); }
  async function begin() { await run(async () => { if (!id) return; setMessage("Starting the confidential duel…"); await send("referee", "startDuel", [id]); await refresh(id); }); }
  async function reveal() { await run(async () => {
    if (!id || !address || !publicClient || !walletClient) return;
    setPhase("revealing"); setMessage("Approve the private pattern reveal.");
    const ciphertexts = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.duel, abi: colorSnapDuelAbi, functionName: "getPuzzleCiphertexts", args: [id], account: address }) as readonly Hex[];
    const values = await decryptClassicValues({ publicClient, walletClient, playerAddress: address, contractAddress: SEPOLIA_CONTRACTS.duel, ciphertexts }); setTarget([...values]); setPieces(INITIAL); setMessage("Memorize the pattern. Three seconds.");
  }); }
  async function submit() { await run(async () => {
    if (!id || !address || !publicClient) return;
    setMessage("Encrypting and submitting your arrangement…");
    const encrypted = await encryptClassicSolution({ publicClient, contractAddress: SEPOLIA_CONTRACTS.duel, playerAddress: address, bottleIds: pieces });
    await send("referee", "submitSolution", [id, encrypted.handles, encrypted.inputProof]); setSubmitted(true); setPhase("active"); setMessage("Submitted. Verify your public result next.");
  }); }
  async function finalize() { await run(async () => {
    if (!id || !address || !publicClient) return;
    setMessage("Fetching the win/loss proof from Zama KMS…");
    const ciphertext = await publicClient.readContract({ address: SEPOLIA_CONTRACTS.duel, abi: colorSnapDuelAbi, functionName: "getPublicResultCiphertext", args: [id, address] }) as Hex;
    const proof = await decryptPublicBooleanWithProof({ publicClient, ciphertext });
    await send("referee", "finalizeResult", [id, address, [...proof.cleartexts], proof.decryptionProof]); setMessage(proof.solved ? "Your verified result is a match. Settle when both are ready." : "Your verified result is a miss. Settle when both are ready.");
  }); }
  async function resolve() { await run(async () => { if (!id) return; await send("referee", "resolveDuel", [id]); await refresh(id); }); }
  async function cancel() { await run(async () => { if (!id) return; await send("escrow", "cancelDuel", [id]); await refresh(id); }); }
  const canDeposit = recovery && id && state && mine >= 0 && ((mine === 0 && state[2] === 1) || (mine === 1 && state[2] === 2));

  return <PlayFrame mode="Duel" number="04" description="Two players place confidential test cUSD on the balance. A verified result settles the stake.">
    <section className="game-panel"><div className="board-side"><div className="board-top"><span>THE BALANCE / {id ? `DUEL ${id}` : "NEW"}</span><span>TEST cUSD</span></div><div className="board-surface"><ColorBoard pieces={phase === "revealing" && target.length === 5 ? target : pieces} selected={selected} reveal={phase === "revealing"} onChoose={phase === "playing" ? choose : undefined} /><div className="board-hint">{phase === "playing" ? "Swap pieces to rebuild the pattern." : "Both players see the same private pattern."}</div></div><div className="board-top"><span>✳ CORAL · ◈ BLUE · ✦ MINT · ◎ AMBER · ✣ VIOLET</span></div></div>
      <div className="control-side"><div className="control-top"><span>ESCROW STATUS</span><span>{phase.toUpperCase()}</span></div><div className="duel-faucet"><span className="duel-faucet-icon" aria-hidden="true">✦</span><div><span className="duel-faucet-kicker">TEST TOKEN FAUCET</span><strong>Need cUSD to play?</strong><small>Mint two stake amounts to your wallet. Free test tokens; Sepolia ETH pays transaction gas.</small></div><button type="button" disabled={busy || stake === undefined} onClick={mint}>{busy ? "WAIT…" : minted ? "MINT MORE ↗" : "MINT TEST cUSD ↗"}</button></div><div className="control-main"><span className="step-tag">STAKE {stake === undefined || decimals === undefined ? "…" : `${Number(stake) / 10 ** decimals} cUSD`}</span><h2>Play for the pot.</h2>
        {!id && <><input className="field" placeholder="Opponent 0x address" value={opponent} onChange={event => setOpponent(event.target.value)} /><button disabled={busy || !recovery} className="primary-action control-action" onClick={create}>Create duel →</button><input className="field" inputMode="numeric" placeholder="Or enter duel ID" value={inputId} onChange={event => setInputId(event.target.value)} /><button className="text-action" onClick={open}>Open duel →</button></>}
        {id && <span className="invite-link">{typeof window !== "undefined" ? `${location.origin}/duel?duel=${id}` : `Duel ${id}`}</span>}
        {canDeposit && <div className="sub-actions"><button disabled={busy} onClick={deposit}>Deposit stake</button><button disabled={busy} onClick={verifyDeposit}>Verify deposit</button></div>}
        {id && recovery && state && (state[2] === 1 || state[2] === 2) && <button disabled={busy} className="text-action" onClick={cancel}>Recover after funding timeout</button>}
        {state?.[2] === 3 && !started && <button disabled={busy} className="primary-action control-action" onClick={begin}>Start duel →</button>}
        {started && !submitted && phase === "active" && <button disabled={busy} className="primary-action control-action" onClick={reveal}>Reveal pattern →</button>}
        {phase === "playing" && <button disabled={busy} className="primary-action control-action" onClick={submit}>Submit arrangement →</button>}
        {started && submitted && state?.[2] === 3 && <div className="sub-actions"><button disabled={busy} onClick={finalize}>Verify my result</button><button disabled={busy} onClick={resolve}>Settle if ready</button></div>}
        {id && <button className="text-action" onClick={() => refresh(id)}>Refresh state</button>}
      </div><div className="status-line">{state ? `Creator ${state[3] ? "deposit verified" : "pending"} · Opponent ${state[4] ? "deposit verified" : "pending"}` : "Deposits are encrypted; results are proof verified"}</div></div>
    </section>
  </PlayFrame>;
}
