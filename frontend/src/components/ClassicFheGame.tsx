"use client";

import { decodeEventLog, type Address, type Hex } from "viem";
import { useAccount, useChainId, usePublicClient, useWalletClient, useWriteContract } from "wagmi";
import { useEffect, useState } from "react";
import { colorSnapFheAbi } from "@/abi/color_snap_fhe";
import { CHAIN_IDS } from "@/config/chains";
import { CONTRACT_ADDRESSES } from "@/config";
import { decryptClassicBoolean, decryptClassicValues, encryptClassicSolution } from "@/lib/zama/classic-fhe";
import Bottle from "./Bottle";

const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7"];
const REVEAL_DURATION_MS = 5_000;

type Status = "idle" | "creating" | "revealing" | "playing" | "submitting" | "decrypting" | "won" | "lost" | "error";

function asAddress(value: string | undefined): Address | undefined {
  return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? (value as Address) : undefined;
}

export default function ClassicFheGame() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA });
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA });
  const { writeContractAsync } = useWriteContract();
  const contractAddress = asAddress(CONTRACT_ADDRESSES.ZAMA_SEPOLIA);
  const [gameId, setGameId] = useState<bigint>();
  const [target, setTarget] = useState<number[]>([]);
  const [bottles, setBottles] = useState([0, 1, 2, 3, 4]);
  const [selected, setSelected] = useState<number>();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("Create a private memory puzzle to begin.");

  const ready = Boolean(contractAddress && address && publicClient && walletClient && chainId === CHAIN_IDS.ETHEREUM_SEPOLIA);

  useEffect(() => {
    if (status !== "revealing") return;
    const timer = window.setTimeout(() => {
      setTarget([]);
      setStatus("playing");
      setMessage("Recreate the private pattern, then submit your encrypted arrangement.");
    }, REVEAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  function chooseBottle(index: number) {
    if (status !== "playing") return;
    if (selected === undefined) {
      setSelected(index);
      return;
    }
    if (selected === index) {
      setSelected(undefined);
      return;
    }
    setBottles((current) => {
      const next = [...current];
      [next[selected], next[index]] = [next[index], next[selected]];
      return next;
    });
    setSelected(undefined);
  }

  async function createGame() {
    if (!ready || !contractAddress || !address || !publicClient || !walletClient) return;
    try {
      setStatus("creating");
      setMessage("Creating an encrypted puzzle on Sepolia…");
      const hash = await writeContractAsync({ address: contractAddress, abi: colorSnapFheAbi, functionName: "createClassicGame" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const event = receipt.logs
        .map((log) => {
          try {
            return decodeEventLog({ abi: colorSnapFheAbi, data: log.data, topics: log.topics });
          } catch {
            return undefined;
          }
        })
        .find((log) => log?.eventName === "GameCreated");
      if (!event || event.eventName !== "GameCreated") throw new Error("Game creation event was not found in the transaction receipt.");

      const id = event.args.gameId;
      setGameId(id);
      const ciphertexts = await publicClient.readContract({
        address: contractAddress,
        abi: colorSnapFheAbi,
        functionName: "getPuzzleCiphertexts",
        args: [id],
        account: address,
      });
      const clearTarget = await decryptClassicValues({
        publicClient,
        walletClient,
        playerAddress: address,
        contractAddress,
        ciphertexts,
      });
      setBottles([0, 1, 2, 3, 4]);
      setSelected(undefined);
      setTarget([...clearTarget]);
      setStatus("revealing");
      setMessage("Memorize your private pattern. It will hide in five seconds.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to create the encrypted game.");
    }
  }

  async function submitSolution() {
    if (!ready || !gameId || !contractAddress || !address || !publicClient || !walletClient) return;
    try {
      setStatus("submitting");
      setMessage("Encrypting your arrangement and submitting it to the confidential referee…");
      const encrypted = await encryptClassicSolution({ publicClient, contractAddress, playerAddress: address, bottleIds: bottles });
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: colorSnapFheAbi,
        functionName: "submitSolution",
        args: [gameId, encrypted.handles, encrypted.inputProof],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setStatus("decrypting");
      setMessage("Privately decrypting your result…");
      const result = await publicClient.readContract({
        address: contractAddress,
        abi: colorSnapFheAbi,
        functionName: "getSolutionResult",
        args: [gameId],
        account: address,
      });
      const solved = await decryptClassicBoolean({ publicClient, walletClient, playerAddress: address, contractAddress, ciphertext: result });
      setStatus(solved ? "won" : "lost");
      setMessage(solved ? "Solved—your result was privately verified." : "Not quite. Create a new puzzle and try again.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unable to submit the encrypted solution.");
    }
  }

  if (!contractAddress) return <SetupMessage text="Set NEXT_PUBLIC_COLOR_SNAP_FHE_ADDRESS after deploying the ColorSnap FHE contract to Ethereum Sepolia." />;
  if (!isConnected) return <SetupMessage text="Connect a wallet to play Classic Confidential." />;
  if (chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA) return <SetupMessage text="Switch your wallet to Ethereum Sepolia to play this confidential game." />;

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-900 px-4 py-12 text-white">
      <section className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur md:p-10">
        <p className="text-sm font-medium uppercase tracking-[0.22em] text-purple-300">Zama FHE · Classic</p>
        <h1 className="mt-3 text-3xl font-bold">Private Color Memory</h1>
        <p className="mt-3 text-white/75">{message}</p>
        <div className="mt-8 rounded-2xl bg-black/20 p-5">
          {status === "revealing" && <p className="mb-4 text-center font-semibold text-amber-300">Private target — visible only to your wallet</p>}
          <div className="flex flex-wrap justify-center gap-y-5">
            {(status === "revealing" ? target : bottles).map((color, index) => (
              <Bottle key={`${status}-${index}-${color}`} color={COLORS[color]} index={index} isTarget={status === "revealing"} isSelected={selected === index} onClick={() => chooseBottle(index)} />
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {(status === "idle" || status === "won" || status === "lost" || status === "error") && <button className="rounded-xl bg-purple-500 px-5 py-3 font-semibold hover:bg-purple-400 disabled:opacity-50" disabled={!ready} onClick={createGame}>Create private puzzle</button>}
          {status === "playing" && <button className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold hover:bg-emerald-400" onClick={submitSolution}>Submit encrypted solution</button>}
        </div>
        {gameId !== undefined && <p className="mt-5 text-center text-xs text-white/45">Game #{gameId.toString()}</p>}
      </section>
    </main>
  );
}

function SetupMessage({ text }: { text: string }) {
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white"><p className="max-w-lg rounded-2xl border border-white/15 bg-white/10 p-6 text-white/80">{text}</p></main>;
}
