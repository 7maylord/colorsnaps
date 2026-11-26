# ColorSnap frontend rewrite

## The first minute

Open ColorSnap, choose **Play game**, pick wallet or email in Reown's sign-in window, and land directly at **Choose a mode**. Each mode shows who plays, what becomes public and whether it costs test tokens. Choosing Classic opens a board with one action, **Create puzzle**. Players should reach that action without scrolling, naming a profile or learning what a ciphertext is.

## Art direction and interaction

Build the experience around a neon stained-glass arcade. Five to seven pieces cast colored light against a dark play surface. Bright, bouncing stars add energy around the entrance, mode cards, and board without covering controls. Give each color a permanent engraved symbol and an accessible name. Use rounded display type, strong contrast, and arcade-like buttons.

| Scene | Signature interaction | Player control |
| --- | --- | --- |
| Entrance | The pointer moves a soft light; stars bounce around the five glass pieces and the Play game button glints. | One Play game button opens Reown's wallet and email picker. Keyboard focus stays visible. |
| Mode room | Four colorful cards glow under the pointer while stars bounce between them. | Select any mode directly. On mobile use a two-by-two layout. Preserve incoming invite links. |
| Classic | Glass shutters open for the three-second private reveal. During play, selecting a piece lights its socket and a second selection swaps the pair. | Click, tap or use the keyboard. Show **Submit arrangement** throughout play. Classic has no solve timer. |
| Daily | A dated pane gains a permanent mark when a result is verified. A verified win unlocks a 20 point claim. | Join today's shared puzzle, play once and revisit the result after UTC rollover. |
| Challenge | Two parallel racks show each player's public progress. The opponent's rack shows participation and verification state. | Create or join by invite. Show the contract deadline after the second player joins. |
| Duel | A two-pan balance shows each deposit moving from pending to accepted. At settlement the visual follows the escrow outcome. | Name the opponent, review the fixed stake, mint test cUSD if needed, deposit, play and inspect payout or draw. |

Keep the native cursor. Drive highlights from pointer position using a single animation frame loop on the active surface. Disable tracking on coarse pointers. Reduced motion uses immediate state changes and a readable reveal timer. Keep focus visible, support Enter/Space to swap, announce transaction stages through a live region and never depend on color or motion to communicate a result.

## Implementation checklist

- [ ] **1. Make login reliable.** The single Play game button opens Reown's wallet and email picker. The app validates placeholder project IDs, uses the browser origin in wallet metadata, and disables analytics. The Reown project owner still needs to enable email and allow local, preview, and production origins in its dashboard. Live signer and clean-profile tests remain.
- [x] **2. Build the shell and mode room.** Entrance, `/modes`, four rooms, session restoration, invite preservation, compact account control, Sepolia-only gameplay, eight deployed addresses, and exported ABIs are implemented. `/game` remains the direct Classic room after mode selection.
- [x] **3. Ship Classic as the first complete slice.** A session hook configures the FHE runtime before any transaction, then handles creation, three-second reveal, swaps, encrypted submission, public proof-verified result, and scoped refresh recovery for game IDs and transaction hashes. It can recover the latest on-chain game if local storage is missing.
- [x] **4. Deliver Daily and Challenge.** Both rooms use the shared board, contract reads, encrypted submissions, KMS proof finalization, and refreshable public state. Daily rankings and Challenge invitations, deadlines, and resolution are present.
- [x] **4a. Put player names and scores on chain.** A separate Sepolia player registry stores editable, wallet-owned public callsigns. The Arcade ranks verified points from Classic wins (+10) and claimed Daily wins (+20), then displays names from the registry. Classic advances to six bottles after 10 finalized games and seven after 30.
- [x] **5. Deliver Duel.** The escrow now has one-hour pending funding recovery. Its replacement and referee were deployed to Sepolia and wired to the existing public-mint test token. The room checks recovery before deposits, encrypts token-bound stake inputs, finalizes deposit and result proofs, and exposes settlement and recovery actions.
- [ ] **6. Release against a clean checkout.** Frozen pnpm install, a production build from a fresh archive of the committed tree, and 57 Forge tests pass. Headless Chrome screenshots cover desktop and 390 px/320 px layouts; reduced motion suppresses glass animation. A browser diagnostic confirmed FHE WASM initializes with the new runtime config. Wallet and email interaction, two-account Sepolia games, refresh during KMS proof, and real touch input remain to be exercised.

**First acceptance gate:** A new player can sign in by either method, choose Classic, play and recover their result after refresh. A returning player reaches the chooser directly. Test the flow on the actual local origin and a deployed preview before extending the board to multiplayer.
