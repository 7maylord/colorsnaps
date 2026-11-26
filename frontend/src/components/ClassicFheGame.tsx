"use client";

import { ColorBoard, PlayFrame } from "./PlayFrame";
import { useClassicSession } from "@/hooks/useClassicSession";

export default function ClassicFheGame() {
  const game = useClassicSession();
  const revealing = game.phase === "revealing" && game.target.length === game.size;
  return <PlayFrame mode="Classic" number="01" description="One private sequence. Three seconds to remember it. No timer while you solve.">
    <section className="game-panel">
      <div className="board-side"><div className="board-top"><span>{revealing ? "PRIVATE REVEAL" : "YOUR WORKBENCH"}</span><span>{game.size} BOTTLES / ONE PATTERN</span></div>
        <div className="board-surface"><ColorBoard pieces={revealing ? game.target : game.pieces} selected={game.selected} reveal={revealing} onChoose={game.phase === "playing" ? game.choose : undefined} /><div className="board-hint">{revealing ? "Remember the light." : game.phase === "playing" ? "Select one piece, then another to swap." : "The secret stays with you."}</div></div>
        <div className="board-top"><span>✳ CORAL · ◈ BLUE · ✦ MINT · ◎ AMBER · ✣ VIOLET{game.size >= 6 ? " · ✹ RUBY" : ""}{game.size >= 7 ? " · ✺ LIME" : ""}</span></div>
      </div>
      <div className="control-side"><div className="control-top"><span>CLASSIC SESSION</span><span>{game.id ? `#${game.id}` : "NEW"}</span></div><div className="control-main"><span className="step-tag">{game.phase.toUpperCase()}</span><div className="arcade-stats"><span>★ {game.points} POINTS</span><span>{game.completedGames} GAMES</span></div>{game.phase === "won" && <div className="victory-burst" aria-hidden="true">✦ ✳ ★ ✦ ★</div>}<h2>{game.phase === "playing" ? "Trust your memory." : revealing ? "Look closely." : game.phase === "won" ? "Perfect match! +10" : game.phase === "lost" ? "Run it back!" : "A pattern just for you."}</h2>
        {game.phase === "idle" && <button className="primary-action control-action" onClick={game.create}>Create puzzle →</button>}
        {game.phase === "playing" && <button className="primary-action control-action" onClick={game.submit}>Submit arrangement →</button>}
        {(game.phase === "won" || game.phase === "lost") && <button className="primary-action control-action" onClick={game.reset}>Play again →</button>}
        {game.phase === "error" && <div className="sub-actions"><button onClick={game.recover}>Retry</button><button onClick={game.reset}>Start fresh</button></div>}
      </div><div className="status-line">Encrypted pattern · Verified public result · Ethereum Sepolia</div></div>
    </section>
  </PlayFrame>;
}
