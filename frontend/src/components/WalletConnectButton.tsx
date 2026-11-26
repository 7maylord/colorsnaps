"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { walletConfigured } from "@/config";
import { CHAIN_IDS } from "@/config/chains";

export default function WalletConnectButton({ method }: { method?: "email" | "wallet" }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { open } = useAppKit();

  if (!walletConfigured) return <span className="wallet-warning">Set NEXT_PUBLIC_PROJECT_ID to enable sign in.</span>;
  if (!isConnected) return <button className="ink-button" onClick={() => open({ view: "Connect" })}>{method === "email" ? "Continue with email ↗" : "Continue with wallet ↗"}</button>;
  return <div className="account-control">
    <button className="account-address" onClick={() => open({ view: "Account" })} title={address}>{address?.slice(0, 6)}…{address?.slice(-4)}</button>
    {chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA && <button onClick={() => switchChain({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA })}>Switch to Sepolia</button>}
    <button onClick={() => disconnect()}>Sign out</button>
  </div>;
}
