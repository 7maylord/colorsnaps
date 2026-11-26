"use client";

import { ColorBoard, PlayFrame } from "./PlayFrame";
import { useClassicSession } from "@/hooks/useClassicSession";

export default function ClassicFheGame() {
  const game = useClassicSession();
  const busy = ["creating", "submitting", "decrypting"].includes(game.phase);
  const revealing = game.phase === "revealing" && game.target.length === 5;
  return <PlayFrame mode="Classic" number="01" description="One private sequence. Five seconds to remember it. No timer while you solve.">
    <section className="game-panel">
      <div className="board-side"><div className="board-top"><span>{revealing ? "PRIVATE REVEAL" : "YOUR WORKBENCH"}</span><span>FIVE PIECES / ONE PATTERN</span></div>
        <div className="board-surface"><ColorBoard pieces={revealing ? game.target : game.pieces} selected={game.selected} reveal={revealing} onChoose={game.phase === "playing" ? game.choose : undefined} /><div className="board-hint">{revealing ? "Remember the light." : game.phase === "playing" ? "Select one piece, then another to swap." : "The secret stays with you."}</div></div>
        <div className="board-top"><span>✳ CORAL · ◈ BLUE · ✦ MINT · ◎ AMBER · ✣ VIOLET</span></div>
      </div>
      <div className="control-side"><div className="control-top"><span>CLASSIC SESSION</span><span>{game.id ? `#${game.id}` : "NEW"}</span></div><div className="control-main"><span className="step-tag">{game.phase.toUpperCase()}</span><h2>{game.phase === "playing" ? "Trust your memory." : revealing ? "Look closely." : game.phase === "won" ? "Perfect match." : game.phase === "lost" ? "Another round?" : "A pattern just for you."}</h2><p role="status" aria-live="polite">{game.message}</p>
        {game.phase === "idle" && <button className="primary-action control-action" onClick={game.create}>Create puzzle →</button>}
        {game.phase === "playing" && <button className="primary-action control-action" onClick={game.submit}>Submit arrangement →</button>}
        {(game.phase === "won" || game.phase === "lost") && <button className="primary-action control-action" onClick={game.reset}>Play again →</button>}
        {game.phase === "error" && <div className="sub-actions"><button onClick={game.recover}>Retry</button><button onClick={game.reset}>Start fresh</button></div>}
        {busy && <span className="status-line">A wallet approval or Sepolia confirmation may take a moment.</span>}
      </div><div className="status-line">Encrypted pattern · Private verification · Ethereum Sepolia</div></div>
    </section>
  </PlayFrame>;
}
