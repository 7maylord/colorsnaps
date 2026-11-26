"use client";

import { createElement, useEffect, useRef } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

type Kind = "info" | "success" | "error" | "warning";

export function notify(kind: Kind, message: string) {
  toast[kind](message, {
    duration: kind === "error" ? 30000 : 10000,
    action: {
      label: createElement("span", { className: "toast-copy-icon" }, createElement(Copy, { size: 16, "aria-hidden": true }), createElement("span", { className: "sr-only" }, "Copy message")),
      onClick: () => { void copyMessage(message); },
    },
  });
}

async function copyMessage(message: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
    await navigator.clipboard.writeText(message);
    toast.success("Message copied");
  } catch {
    toast.error("Could not copy the message");
  }
}

export function errorText(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback;
}

export function useMessageToast(message: string, phase: string) {
  const lastMessage = useRef(message);
  useEffect(() => {
    if (lastMessage.current === message) return;
    lastMessage.current = message;
    if (phase === "error") notify("error", message);
    else if (phase === "won" || phase === "settled" || phase === "resolved" || /minted|verified|confirmed|deposit received|submitted\./i.test(message)) notify("success", message);
    else notify("info", message);
  }, [message, phase]);
}
