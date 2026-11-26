"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { colorSnapPlayerRegistryAbi, SEPOLIA_CHAIN_ID, SEPOLIA_CONTRACTS } from "@/contracts";

export function usePlayerProfile() {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: SEPOLIA_CHAIN_ID });
  const { writeContractAsync } = useWriteContract();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setName("");
    setLoaded(false);
    if (!address || !publicClient || !SEPOLIA_CONTRACTS.playerRegistry) { setLoaded(true); return; }
    publicClient.readContract({ address: SEPOLIA_CONTRACTS.playerRegistry, abi: colorSnapPlayerRegistryAbi, functionName: "names", args: [address] })
      .then(value => { if (!cancelled) setName(value as string); })
      .catch(() => { if (!cancelled) setName(""); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [address, publicClient]);
  async function save(value: string) {
    const next = value.trim().replace(/\s+/g, " ").slice(0, 20);
    if (!/^[A-Za-z0-9_-][A-Za-z0-9 _-]{0,18}[A-Za-z0-9_-]$/.test(next)) throw new Error("Use 2–20 letters, numbers, spaces, _ or -. No edge spaces.");
    if (!address) throw new Error("Connect your account first.");
    if (!SEPOLIA_CONTRACTS.playerRegistry || !publicClient) throw new Error("Player registry has not been deployed on Sepolia yet.");
    setSaving(true);
    try {
      const hash = await writeContractAsync({ address: SEPOLIA_CONTRACTS.playerRegistry, abi: colorSnapPlayerRegistryAbi, functionName: "setName", args: [next], chainId: SEPOLIA_CHAIN_ID });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error("The name transaction reverted.");
      setName(next);
    } finally { setSaving(false); }
  }
  return { name, loaded, saving, save };
}
