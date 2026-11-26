"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { CHAIN_IDS } from "@/config/chains";
import { colorSnapArcadeAbi, SEPOLIA_CONTRACTS, SEPOLIA_CHAIN_ID } from "@/contracts";
import { decryptClassicValues, decryptPublicBooleanWithProof, encryptArcadeSolution, prepareFhevmRuntime } from "@/lib/zama/classic-fhe";
import { errorText, notify, useMessageToast } from "@/lib/notifications";

type Phase = "idle" | "creating" | "revealing" | "playing" | "submitting" | "decrypting" | "won" | "lost" | "error";
type Saved = { id?: string; pending?: Hex; pendingType?: "create" | "submit"; dismissed?: boolean };
const START = [0, 1, 2, 3, 4];

export function useClassicSession() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA });
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA });
  const { writeContractAsync } = useWriteContract();
  const [id, setId] = useState<bigint>();
  const [target, setTarget] = useState<number[]>([]);
  const [pieces, setPieces] = useState<number[]>(START);
  const [selected, setSelected] = useState<number>();
  const [phase, setPhase] = useState<Phase>("idle");
  const [size, setSize] = useState(5);
  const [completedGames, setCompletedGames] = useState(0);
  const [points, setPoints] = useState(0);
  const [message, setMessage] = useState("Create a puzzle to begin.");
  useMessageToast(message, phase);
  const contractAddress = SEPOLIA_CONTRACTS.arcade;
  const key = address ? `colorsnap:classic:${SEPOLIA_CHAIN_ID}:${contractAddress.toLowerCase()}:${address.toLowerCase()}` : "";

  const save = useCallback((saved: Saved) => { if (key) localStorage.setItem(key, JSON.stringify(saved)); }, [key]);
  const loadStats = useCallback(async () => {
    if (!address || !publicClient) return;
    const [completed, earned, nextSize] = await Promise.all([
      publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "completedGames", args: [address] }) as Promise<bigint>,
      publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "points", args: [address] }) as Promise<bigint>,
      publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "nextPuzzleSize", args: [address] }) as Promise<number>,
    ]);
    setCompletedGames(Number(completed)); setPoints(Number(earned)); setSize(Number(nextSize));
  }, [address, publicClient, contractAddress]);
  const reveal = useCallback(async (gameId: bigint) => {
    if (!address || !publicClient || !walletClient) throw new Error("Wallet is not ready for private reveal.");
    setPhase("revealing"); setMessage("Approve the private reveal in your wallet.");
    const ciphertexts = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getPuzzleCiphertexts", args: [gameId], account: address }) as readonly Hex[];
    const values = await decryptClassicValues({ publicClient, walletClient, playerAddress: address, contractAddress, ciphertexts });
    setSize(values.length); setTarget([...values]); setPieces(Array.from({ length: values.length }, (_, i) => i)); setSelected(undefined);
    setMessage("Memorize your private pattern. It hides in three seconds.");
  }, [address, publicClient, walletClient, contractAddress]);

  const showResult = useCallback(async (gameId: bigint) => {
    if (!publicClient) throw new Error("Sepolia RPC is unavailable.");
    setPhase("decrypting"); setMessage("Verifying your encrypted result for points…");
    const game = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getGame", args: [gameId] }) as readonly [Hex, number, number, bigint, boolean, boolean];
    let solved = game[5];
    if (!game[4]) {
      const ciphertext = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getPublicResultCiphertext", args: [gameId] }) as Hex;
      const proof = await decryptPublicBooleanWithProof({ publicClient, ciphertext });
      solved = proof.solved;
      setMessage("Approve the result proof to receive Classic points.");
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "finalizeResult", args: [gameId, [...proof.cleartexts], proof.decryptionProof], chainId: SEPOLIA_CHAIN_ID });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Result proof was not accepted.");
    }
    await loadStats();
    setPhase(solved ? "won" : "lost"); setMessage(solved ? "The confidential referee verified your match." : "The pattern did not match. Try another puzzle.");
  }, [publicClient, contractAddress, writeContractAsync, loadStats]);

  useEffect(() => {
    setId(undefined); setTarget([]); setPieces(START); setSelected(undefined); setPhase("idle"); setMessage("Create a puzzle to begin.");
    if (!key || !publicClient || !address) return;
    void loadStats();
    let cancelled = false;
    (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "{}") as Saved;
        let gameId = saved.id ? BigInt(saved.id) : undefined;
        if (saved.pending) {
          setPhase(saved.pendingType === "submit" ? "submitting" : "creating");
          setMessage("Recovering your pending Sepolia transaction…");
          const receipt = await publicClient.waitForTransactionReceipt({ hash: saved.pending });
          if (receipt.status !== "success") throw new Error("The pending transaction reverted.");
          if (saved.pendingType === "create") {
            const event = receipt.logs.map(log => { try { return decodeEventLog({ abi: colorSnapArcadeAbi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(event => event?.eventName === "GameCreated");
            if (event?.eventName !== "GameCreated") throw new Error("Game creation event was not found.");
            gameId = (event.args as unknown as { gameId: bigint }).gameId;
          }
          if (gameId) save({ id: gameId.toString() });
        }
        if (!gameId && !saved.dismissed) {
          const games = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getPlayerGames", args: [address] }) as bigint[];
          gameId = games.at(-1);
          if (gameId) save({ id: gameId.toString() });
        }
        if (cancelled || !gameId) return;
        setId(gameId);
        const game = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getGame", args: [gameId] }) as readonly [Hex, number, number, bigint, boolean, boolean];
        if (game[0].toLowerCase() !== address.toLowerCase()) throw new Error("Saved game belongs to another account.");
        if (game[2] === 3) { save({ dismissed: true }); return; }
        if (cancelled) return;
        if (game[2] === 2) await showResult(gameId); else await reveal(gameId);
      } catch (error) { if (!cancelled) { setPhase("error"); notify("error", errorText(error, "Could not restore the game.")); } }
    })();
    return () => { cancelled = true; };
  }, [key, address, publicClient, contractAddress, save, reveal, showResult, loadStats]);

  useEffect(() => {
    if (phase !== "revealing" || target.length !== size) return;
    const timer = window.setTimeout(() => { setTarget([]); setPhase("playing"); setMessage("Select two pieces to swap them. Submit when the pattern feels right."); }, 3000);
    return () => clearTimeout(timer);
  }, [phase, target, size]);

  function choose(index: number) {
    if (phase !== "playing") return;
    if (selected === undefined) { setSelected(index); return; }
    if (selected === index) { setSelected(undefined); return; }
    setPieces(current => { const next = [...current]; [next[selected], next[index]] = [next[index], next[selected]]; return next; });
    setSelected(undefined);
  }

  async function create() {
    if (!address || !publicClient || !walletClient) return;
    try {
      setPhase("creating"); setMessage("Loading the private game engine…");
      await prepareFhevmRuntime();
      setMessage("Approve puzzle creation in your wallet.");
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "createClassicGame", chainId: SEPOLIA_CHAIN_ID });
      save({ pending: hash, pendingType: "create" }); setMessage("Waiting for Sepolia confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Puzzle creation reverted.");
      const event = receipt.logs.map(log => { try { return decodeEventLog({ abi: colorSnapArcadeAbi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(event => event?.eventName === "GameCreated");
      if (event?.eventName !== "GameCreated") throw new Error("Game creation event was not found.");
      const gameId = (event.args as unknown as { gameId: bigint }).gameId;
      setId(gameId); save({ id: gameId.toString() }); await reveal(gameId);
    } catch (error) { setPhase("error"); notify("error", errorText(error, "Could not create the puzzle.")); }
  }

  async function submit() {
    if (!id || !address || !publicClient || !walletClient) return;
    try {
      setPhase("submitting"); setMessage("Encrypting your arrangement…");
      const encrypted = await encryptArcadeSolution({ publicClient, contractAddress, playerAddress: address, bottleIds: pieces });
      setMessage("Approve encrypted submission in your wallet.");
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "submitSolution", args: [id, encrypted.handles, encrypted.inputProof], chainId: SEPOLIA_CHAIN_ID });
      save({ id: id.toString(), pending: hash, pendingType: "submit" }); setMessage("Waiting for Sepolia confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Submission reverted.");
      save({ id: id.toString() }); await showResult(id);
    } catch (error) { setPhase("error"); notify("error", errorText(error, "Could not submit the arrangement.")); }
  }

  async function recover() {
    if (!id || !address || !publicClient) {
      const saved = key ? JSON.parse(localStorage.getItem(key) || "{}") as Saved : {};
      if (saved.pending) { window.location.reload(); return; }
      await create(); return;
    }
    try {
      const game = await publicClient.readContract({ address: contractAddress, abi: colorSnapArcadeAbi, functionName: "getGame", args: [id] }) as readonly [Hex, number, number, bigint, boolean, boolean];
      if (game[2] === 2) await showResult(id); else await reveal(id);
    } catch (error) { setPhase("error"); notify("error", errorText(error, "Could not recover the game.")); }
  }

  function reset() { save({ dismissed: true }); setId(undefined); setTarget([]); setPieces(Array.from({ length: size }, (_, i) => i)); setSelected(undefined); setPhase("idle"); setMessage("Create a puzzle to begin."); }
  return { id, target, pieces, selected, size, completedGames, points, phase, message, choose, create, submit, recover, reset };
}
