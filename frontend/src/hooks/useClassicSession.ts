"use client";

import { useCallback, useEffect, useState } from "react";
import { decodeEventLog, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { CHAIN_IDS } from "@/config/chains";
import { colorSnapGameAbi, SEPOLIA_CONTRACTS, SEPOLIA_CHAIN_ID } from "@/contracts";
import { decryptClassicBoolean, decryptClassicValues, encryptClassicSolution, prepareFhevmRuntime } from "@/lib/zama/classic-fhe";

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
  const [message, setMessage] = useState("Create a puzzle to begin.");
  const contractAddress = SEPOLIA_CONTRACTS.game;
  const key = address ? `colorsnap:classic:${SEPOLIA_CHAIN_ID}:${contractAddress.toLowerCase()}:${address.toLowerCase()}` : "";

  const save = useCallback((saved: Saved) => { if (key) localStorage.setItem(key, JSON.stringify(saved)); }, [key]);
  const reveal = useCallback(async (gameId: bigint) => {
    if (!address || !publicClient || !walletClient) throw new Error("Wallet is not ready for private reveal.");
    setPhase("revealing"); setMessage("Approve the private reveal in your wallet.");
    const ciphertexts = await publicClient.readContract({ address: contractAddress, abi: colorSnapGameAbi, functionName: "getPuzzleCiphertexts", args: [gameId], account: address });
    const values = await decryptClassicValues({ publicClient, walletClient, playerAddress: address, contractAddress, ciphertexts });
    setTarget([...values]); setPieces(START); setSelected(undefined);
    setMessage("Memorize your private pattern. It hides in five seconds.");
  }, [address, publicClient, walletClient, contractAddress]);

  const showResult = useCallback(async (gameId: bigint) => {
    if (!address || !publicClient || !walletClient) throw new Error("Wallet is not ready for result decryption.");
    setPhase("decrypting"); setMessage("Approve private result decryption.");
    const ciphertext = await publicClient.readContract({ address: contractAddress, abi: colorSnapGameAbi, functionName: "getSolutionResult", args: [gameId], account: address });
    const solved = await decryptClassicBoolean({ publicClient, walletClient, playerAddress: address, contractAddress, ciphertext });
    setPhase(solved ? "won" : "lost"); setMessage(solved ? "The confidential referee verified your match." : "The pattern did not match. Try another puzzle.");
  }, [address, publicClient, walletClient, contractAddress]);

  useEffect(() => {
    setId(undefined); setTarget([]); setPieces(START); setSelected(undefined); setPhase("idle"); setMessage("Create a puzzle to begin.");
    if (!key || !publicClient || !address) return;
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
            const event = receipt.logs.map(log => { try { return decodeEventLog({ abi: colorSnapGameAbi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(event => event?.eventName === "GameCreated");
            if (event?.eventName !== "GameCreated") throw new Error("Game creation event was not found.");
            gameId = event.args.gameId;
          }
          if (gameId) save({ id: gameId.toString() });
        }
        if (!gameId && !saved.dismissed) {
          const games = await publicClient.readContract({ address: contractAddress, abi: [{ type: "function", name: "getPlayerGames", stateMutability: "view", inputs: [{ name: "player", type: "address" }], outputs: [{ type: "uint256[]" }] }] as const, functionName: "getPlayerGames", args: [address] });
          gameId = games.at(-1);
          if (gameId) save({ id: gameId.toString() });
        }
        if (cancelled || !gameId) return;
        setId(gameId);
        const game = await publicClient.readContract({ address: contractAddress, abi: [{ type: "function", name: "getGame", stateMutability: "view", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "player", type: "address" }, { name: "status", type: "uint8" }, { name: "createdAt", type: "uint256" }, { name: "hasSubmission", type: "bool" }, { name: "submittedAt", type: "uint256" }] }] as const, functionName: "getGame", args: [gameId] });
        if (game[0].toLowerCase() !== address.toLowerCase()) throw new Error("Saved game belongs to another account.");
        if (game[1] === 3) { save({ dismissed: true }); return; }
        if (cancelled) return;
        if (game[3]) await showResult(gameId); else await reveal(gameId);
      } catch (error) { if (!cancelled) { setPhase("error"); setMessage(error instanceof Error ? error.message : "Could not restore the game."); } }
    })();
    return () => { cancelled = true; };
  }, [key, address, publicClient, contractAddress, save, reveal, showResult]);

  useEffect(() => {
    if (phase !== "revealing" || target.length !== 5) return;
    const timer = window.setTimeout(() => { setTarget([]); setPhase("playing"); setMessage("Select two pieces to swap them. Submit when the pattern feels right."); }, 5000);
    return () => clearTimeout(timer);
  }, [phase, target]);

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
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapGameAbi, functionName: "createClassicGame" });
      save({ pending: hash, pendingType: "create" }); setMessage("Waiting for Sepolia confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Puzzle creation reverted.");
      const event = receipt.logs.map(log => { try { return decodeEventLog({ abi: colorSnapGameAbi, data: log.data, topics: log.topics }); } catch { return undefined; } }).find(event => event?.eventName === "GameCreated");
      if (event?.eventName !== "GameCreated") throw new Error("Game creation event was not found.");
      const gameId = event.args.gameId;
      setId(gameId); save({ id: gameId.toString() }); await reveal(gameId);
    } catch (error) { setPhase("error"); setMessage(error instanceof Error ? error.message : "Could not create the puzzle."); }
  }

  async function submit() {
    if (!id || !address || !publicClient || !walletClient) return;
    try {
      setPhase("submitting"); setMessage("Encrypting your arrangement…");
      const encrypted = await encryptClassicSolution({ publicClient, contractAddress, playerAddress: address, bottleIds: pieces });
      setMessage("Approve encrypted submission in your wallet.");
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapGameAbi, functionName: "submitSolution", args: [id, encrypted.handles, encrypted.inputProof] });
      save({ id: id.toString(), pending: hash, pendingType: "submit" }); setMessage("Waiting for Sepolia confirmation…");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("Submission reverted.");
      save({ id: id.toString() }); await showResult(id);
    } catch (error) { setPhase("error"); setMessage(error instanceof Error ? error.message : "Could not submit the arrangement."); }
  }

  async function recover() {
    if (!id || !address || !publicClient) {
      const saved = key ? JSON.parse(localStorage.getItem(key) || "{}") as Saved : {};
      if (saved.pending) { window.location.reload(); return; }
      await create(); return;
    }
    try {
      const game = await publicClient.readContract({ address: contractAddress, abi: [{ type: "function", name: "getGame", stateMutability: "view", inputs: [{ name: "gameId", type: "uint256" }], outputs: [{ name: "player", type: "address" }, { name: "status", type: "uint8" }, { name: "createdAt", type: "uint256" }, { name: "hasSubmission", type: "bool" }, { name: "submittedAt", type: "uint256" }] }] as const, functionName: "getGame", args: [id] });
      if (game[3]) await showResult(id); else await reveal(id);
    } catch (error) { setPhase("error"); setMessage(error instanceof Error ? error.message : "Could not recover the game."); }
  }

  function reset() { save({ dismissed: true }); setId(undefined); setTarget([]); setPieces(START); setSelected(undefined); setPhase("idle"); setMessage("Create a puzzle to begin."); }
  return { id, target, pieces, selected, phase, message, choose, create, submit, recover, reset };
}
