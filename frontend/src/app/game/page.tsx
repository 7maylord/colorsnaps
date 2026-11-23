"use client";

import dynamic from "next/dynamic";
const ClassicFheGame = dynamic(() => import("../../components/ClassicFheGame"), { ssr: false });

export default function GamePage() {
  return <ClassicFheGame />;
} 
