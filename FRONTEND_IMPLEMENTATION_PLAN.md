# ColorSnap frontend rewrite

## The first minute

Open ColorSnap, choose **Continue with wallet** or **Continue with email**, and land directly at **Choose a mode**. Each mode shows who plays, what becomes public and whether it costs test tokens. Choosing Classic opens a board with one action, **Create puzzle**. Players should reach that action without scrolling, naming a profile or learning what a ciphertext is.

## Art direction and interaction

Build the experience around a stained-glass workbench. Five glass pieces cast colored light across a warm paper surface. Give each color a permanent engraved symbol and an accessible name. Use the existing Geist fonts, large editorial labels and crisp dark outlines. Prototype the actual playable pieces first so the visual treatment earns its place during play.

| Scene | Signature interaction | Player control |
| --- | --- | --- |
| Entrance | A nearby pointer bends a beam through a prism. On sign-in the beam splits into four paths. | Both login buttons work immediately. Keyboard focus or a tap lights the prism. |
| Mode room | Four labeled instruments occupy one tabletop. Focus Classic to illuminate five loose pieces, Daily to stamp today's UTC date, Challenge to link two racks, or Duel to tip a balance. | Select any instrument directly. On mobile place them in a thumb-reachable two-by-two layout. Show the incoming invite on its instrument. |
| Classic | Glass shutters open for the five-second private reveal. During play, selecting a piece lights its socket and a second selection swaps the pair. | Click, tap or use the keyboard. Show **Submit arrangement** throughout play. Classic has no solve timer. |
| Daily | A dated pane gains a permanent mark when a result is verified. The same surface unfolds to show that day's rankings. | Join today's shared puzzle, play once and revisit the result after UTC rollover. |
| Challenge | Two parallel racks show each player's public progress. The opponent's rack shows participation and verification state. | Create or join by invite. Show the contract deadline after the second player joins. |
| Duel | A two-pan balance shows each deposit moving from pending to accepted. At settlement the visual follows the escrow outcome. | Name the opponent, review the fixed stake, mint test cUSD if needed, deposit, play and inspect payout or draw. |

Keep the native cursor. Drive highlights from pointer position using a single animation frame loop on the active surface. Disable tracking on coarse pointers. Reduced motion uses immediate state changes and a readable reveal timer. Keep focus visible, support Enter/Space to swap, announce transaction stages through a live region and never depend on color or motion to communicate a result.

## Implementation checklist

- [ ] **1. Make login reliable.** The app now validates placeholder project IDs, uses the browser origin in wallet metadata, disables analytics, and offers wallet and email through Reown. The Reown project owner still needs to enable email and allow local, preview, and production origins in its dashboard. Live signer and clean-profile tests remain.
- [x] **2. Build the shell and mode room.** Entrance, `/modes`, four rooms, session restoration, invite preservation, compact account control, Sepolia-only gameplay, six deployed addresses, and exported ABIs are implemented. `/game` remains the direct Classic room after mode selection.
- [x] **3. Ship Classic as the first complete slice.** A session hook handles FHE creation, reveal, swaps, encrypted submission, private result, and scoped refresh recovery for game IDs and transaction hashes.
- [x] **4. Deliver Daily and Challenge.** Both rooms use the shared board, contract reads, encrypted submissions, KMS proof finalization, and refreshable public state. Daily rankings and Challenge invitations, deadlines, and resolution are present.
- [x] **5. Deliver Duel.** The escrow now has one-hour pending funding recovery. Its replacement and referee were deployed to Sepolia and wired to the existing public-mint test token. The room checks recovery before deposits, encrypts token-bound stake inputs, finalizes deposit and result proofs, and exposes settlement and recovery actions.
- [ ] **6. Release against a clean checkout.** Frozen pnpm install, a production build from a fresh archive of the committed tree, and 50 Forge tests pass. Browser interaction, two-account Sepolia games, email signing, refresh during KMS proof, and visual checks on touch and reduced motion remain to be exercised.

**First acceptance gate:** A new player can sign in by either method, choose Classic, play and recover their result after refresh. A returning player reaches the chooser directly. Test the flow on the actual local origin and a deployed preview before extending the board to multiplayer.
