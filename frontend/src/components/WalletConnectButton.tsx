"use client";

import { useAppKit } from "@reown/appkit/react";
import { useAccount, useChainId, useDisconnect, useSwitchChain } from "wagmi";
import { walletConfigured } from "@/config";
import { CHAIN_IDS } from "@/config/chains";
import { notify } from "@/lib/notifications";

export default function WalletConnectButton({ play = false }: { play?: boolean }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { open } = useAppKit();

  if (!walletConfigured) return <button className="ink-button" onClick={() => notify("error", "Set NEXT_PUBLIC_PROJECT_ID to enable sign in.")}>Connect ↗</button>;
  if (!isConnected) return <button className={play ? "ink-button play-button" : "ink-button"} onClick={() => open({ view: "Connect" })}>{play ? <><span className="play-button-star" aria-hidden="true">✦</span><span>Play game</span><span className="play-button-arrow" aria-hidden="true">↗</span></> : "Connect ↗"}</button>;
  return <div className="account-control">
    <button className="account-address" onClick={() => open({ view: "Account" })} title={address}>{address?.slice(0, 6)}…{address?.slice(-4)}</button>
    {chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA && <button onClick={() => switchChain({ chainId: CHAIN_IDS.ETHEREUM_SEPOLIA })}>Switch to Sepolia</button>}
    <button onClick={() => disconnect()}>Sign out</button>
  </div>;
}
