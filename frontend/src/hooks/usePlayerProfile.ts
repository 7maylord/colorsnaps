"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

export function usePlayerProfile() {
  const { address } = useAccount();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setName(address ? localStorage.getItem(`colorsnap:callsign:${address.toLowerCase()}`) || "" : "");
    setLoaded(true);
  }, [address]);
  function save(value: string) {
    const next = value.trim().replace(/\s+/g, " ").slice(0, 20);
    if (next.length < 2) throw new Error("Choose at least two characters for your callsign.");
    if (!address) throw new Error("Connect your account first.");
    localStorage.setItem(`colorsnap:callsign:${address.toLowerCase()}`, next);
    setName(next);
  }
  return { name, loaded, save };
}
