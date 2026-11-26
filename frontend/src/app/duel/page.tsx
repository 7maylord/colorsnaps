"use client";
import dynamic from "next/dynamic";
const DuelRoom = dynamic(() => import("@/components/DuelRoom"), { ssr: false });
export default function DuelPage() { return <DuelRoom />; }
