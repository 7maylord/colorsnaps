"use client";
import dynamic from "next/dynamic";
const ConfidentialMatch = dynamic(() => import("@/components/ConfidentialMatch"), { ssr: false });
export default function DailyPage() { return <ConfidentialMatch mode="daily" />; }
