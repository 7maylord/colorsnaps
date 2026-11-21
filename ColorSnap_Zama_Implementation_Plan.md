# ColorSnap --- Zama Confidential Gaming Implementation Plan

**Target:** Zama Developer Program Mainnet Season 5 --- Confidential
Gaming\
**Network:** Ethereum Sepolia\
**Document type:** Product requirements, technical architecture,
tokenomics and Codex implementation plan\
**Status:** Proposed implementation blueprint\
**Project:**
[github.com/7maylord/colorsnap](https://github.com/7maylord/colorsnap)

------------------------------------------------------------------------

## 1. Executive summary

Upgrade the existing ColorSnap bottle-sorting puzzle into a confidential
onchain game powered by the Zama Protocol and FHEVM.

Players rearrange coloured bottles in a responsive frontend. Bottle
movements, undo, reset, animations and local timing happen in the
browser without blockchain transactions. In Classic, the target is a
memory-puzzle pattern: it is revealed only to the game's player through
authorized user decryption, then remains encrypted onchain while that
player reconstructs it. The contract evaluates encrypted player
submissions. Only authorized or explicitly public result values are
decrypted.

The product has three game modes:

1.  **Classic:** free single-player confidential puzzles.
2.  **Daily Challenge:** one shared encrypted puzzle per UTC day, with
    public result verification and community rankings.
3.  **Duel:** two players compete against the same encrypted target,
    stake confidential tokens through ERC-7984, and the winner receives
    the prize pool less a protocol fee.

The design principle is:

> The blockchain is the confidential referee, not the game controller.

FHE is not included as decoration. It protects the target arrangement
from chain observers and other players, and supports confidential
verification. The target remains encrypted onchain throughout active
gameplay, even when the Classic player is authorized to view it during
the initial reveal.

### 1.1 Bounty acceptance goals

The finished submission must demonstrate:

-   A functioning game built on Zama FHEVM.
-   A polished, intuitive frontend.
-   Encrypted game state that materially changes what is possible.
-   Correct access control for decryption.
-   Onchain randomness for target generation.
-   Verifiable results for games involving competition or chance.
-   A functioning Sepolia deployment.
-   ERC-7984 confidential tokens for Duel stakes and rewards.
-   Clear documentation, tests and a three-minute real-person video
    pitch.
-   An X post or thread introducing the project.

------------------------------------------------------------------------

## 2. Product vision and game loop

ColorSnap presents players with a set of coloured bottles and asks them
to arrange them into a target order remembered from an initial private
reveal.

The target is generated and stored as encrypted state onchain. Players
can rearrange the visible bottles locally. When ready, they submit an
encrypted arrangement. The contract compares it against the encrypted
target and produces an encrypted result.

### 2.1 Core gameplay loop

1.  Player selects a game mode.
2.  Player creates or joins a game.
3.  Contract creates or loads the encrypted target.
4.  Classic frontend retrieves the player's authorized target ciphertexts,
    decrypts them for the initial reveal, and displays the starting
    arrangement.
5.  Player rearranges bottles locally.
6.  Player submits a final arrangement.
7.  Contract evaluates the encrypted submission.
8.  The appropriate result is decrypted and verified.
9.  Game state and, where applicable, rewards are finalized.

### 2.2 UX principle

No blockchain transaction should be required for:

-   Moving a bottle.
-   Swapping two positions.
-   Undoing a move.
-   Resetting the board.
-   Animating a bottle.
-   Updating the local timer.
-   Updating the local move counter.

Blockchain interactions should occur only at meaningful checkpoints:
game creation, joining, staking, solution submission, result
verification and settlement.

The frontend must clearly distinguish transaction confirmation from FHE
computation and decryption. A submitted transaction is not proof that
the player has won.

------------------------------------------------------------------------

## 3. Game modes

## 3.1 Classic Mode

**Purpose:** Single-player onboarding and repeatable puzzle play.

### Flow

1.  Player selects Classic.
2.  Player creates a game.
3.  Contract generates an encrypted target permutation.
4.  Frontend receives the public starting arrangement and game ID.
5.  Player rearranges bottles locally.
6.  Player submits one encrypted final arrangement.
7.  Contract evaluates the submission.
8.  Player decrypts their authorized success/failure result.

### Rules

-   No entry fee.
-   No financial reward.
-   Recommended three-minute timer.
-   Local move counter.
-   One official solution submission per game.
-   An unsuccessful submission ends that attempt; player can start a new
    game.
-   New game means a new encrypted target.

### Scoring

Illustrative offchain achievement scoring:

  Performance                       Points
  ------------------------------- --------
  Successful completion                100
  Completion within 60 seconds         +30
  Completion within 120 seconds        +15

Client-reported time and move count are not trustless onchain
measurements. They must not be used to determine financial rewards or
described as cryptographically verified.

## 3.2 Daily Challenge

**Purpose:** Retention, community participation and a shared
competition.

### Flow

1.  A daily challenge is created for a UTC calendar day.
2.  Contract generates one encrypted target.
3.  Every participant receives the same public starting arrangement.
4.  Each player independently solves the puzzle.
5.  Each player submits one encrypted arrangement.
6.  Contract evaluates each submission.
7.  Successful results are made publicly verifiable without revealing
    the target during active play.

### Rules

-   One shared target per UTC day.
-   No entry fee.
-   One official submission per wallet.
-   Daily completion streak.
-   Community leaderboard.
-   Previous challenge results remain accessible.

### Leaderboard

Recommended ordering:

1.  Verified successful submissions before unsuccessful submissions.
2.  Earliest onchain submission timestamp among verified successful
    submissions.
3.  Move count and elapsed time may be shown as optional client-reported
    statistics, clearly marked unverified.

Use the original onchain submission timestamp, not asynchronous FHE
decryption callback order. Include a verification grace period for
pending results.

## 3.3 Duel Mode

**Purpose:** Competitive flagship mode and the main ERC-7984
demonstration.

Two players compete to solve the same encrypted target. Each player
posts an equal confidential-token stake.

### Flow

1.  Player A creates a Duel lobby.
2.  Player A selects a stake tier.
3.  Player A deposits the required confidential token amount.
4.  Player B joins and deposits the matching amount.
5.  Contract creates one encrypted target shared by both players.
6.  Both players receive the same public starting arrangement.
7.  Both players play independently and locally.
8.  Each player submits one encrypted final arrangement.
9.  Contract evaluates both encrypted submissions.
10. Verified outcomes determine the winner.
11. The escrow settles the prize.

### Rules

-   Two players per match.
-   Equal entry stakes.
-   Same target and starting arrangement.
-   Recommended three-minute match deadline.
-   One official submission per player.
-   Target and submitted arrangements remain encrypted during active
    gameplay.
-   Only verified success/failure outcomes are publicly revealed.
-   First valid successful submission wins.
-   If neither player succeeds before expiry, both receive refunds.
-   If one player succeeds, the other player's later submission cannot
    change the winner.
-   Settlement must execute exactly once.

### Winner-selection race condition

FHE verification and public decryption are asynchronous. Do not choose
the winner based on the order in which decryption callbacks arrive.

Instead:

1.  Record each player's `submittedAt` timestamp when the encrypted
    solution is accepted.
2.  Generate the encrypted success result.
3.  Obtain and verify the public decryption proof.
4.  Associate the verified result with the original submission.
5.  Resolve both results, or wait until the deadline and verification
    grace period.
6.  Select the earliest successful submission.
7.  Settle once.

The implementation must define a deterministic tie policy. If two
successful submissions have the same block timestamp, use transaction
ordering within the block or a documented deterministic tie-breaker. Do
not rely on offchain relayer timing.

------------------------------------------------------------------------

## 4. Zama FHE architecture

### 4.1 System overview

``` text
Next.js frontend
  ├── Local bottle interactions
  ├── Wallet connection
  ├── Game state and UI
  └── Zama SDK
       ├── Encrypted input creation
       ├── Input proof generation
       └── User/public decryption workflows
              |
              v
ColorSnap Solidity contracts
  ├── Encrypted target storage
  ├── Encrypted solution validation
  ├── FHE comparisons
  ├── ACL permissions
  ├── Result lifecycle
  └── Duel escrow coordination
              |
       Zama FHEVM / coprocessors
              |
       Ethereum Sepolia
              |
       ERC-7984 confidential token
```

### 4.2 Confidential data model

  -----------------------------------------------------------------------
  Data                    Representation          Intended visibility
  ----------------------- ----------------------- -----------------------
  Target bottle positions Encrypted `euint8`      Contract computation
                          handles                 only while active

  Random priorities       Encrypted `euint64`     Contract computation
                          handles                 only

  Submitted arrangement   Encrypted `euint8`      Contract computation
                          handles                 only

  Success/failure         Encrypted `ebool`       Authorized player or
                                                  public after
                                                  verification setup

  Player addresses        Public                  Everyone

  Game ID                 Public                  Everyone

  Deadline                Public                  Everyone

  Game mode               Public                  Everyone

  Token balances and      ERC-7984 ciphertexts    According to token ACL
  transfer amounts                                

  Duel winner             Public after verified   Everyone
                          result                  
  -----------------------------------------------------------------------

Never expose plaintext target values through public getters, events,
metadata, frontend bundles or logs during active gameplay.

### 4.3 Target generation

The target must be a permutation of five unique bottle identifiers. Do
not generate five independent random bottle values because duplicates
could occur.

Proposed algorithm:

1.  Initialize bottle identifiers `0, 1, 2, 3, 4`.
2.  Generate five encrypted 64-bit random priorities using the current
    supported FHEVM random API, such as `FHE.randEuint64()`, after
    confirming the exact API for the installed version.
3.  Associate each priority with its bottle identifier.
4.  Sort the encrypted priority/identifier pairs using a fixed
    compare-and-swap sorting network.
5.  Use encrypted comparisons such as `FHE.lt()`.
6.  Use `FHE.select()` to conditionally swap encrypted priorities and
    identifiers.
7.  Store the resulting encrypted identifiers as the target permutation.

Implementation requirements:

-   Random generation must execute in a transaction, not an `eth_call`.
-   Use `FHE.allowThis()` for ciphertexts that must persist across
    transactions.
-   Do not emit target ciphertexts in custom events.
-   Do not expose a public target getter.
-   Benchmark FHE operation count, gas and execution latency.
-   Confirm the current Sepolia randomness support and any operational
    constraints before relying on it for economic outcomes.

The exact sorting network and FHE types must be validated against the
pinned FHEVM Solidity library. The pseudocode is architectural guidance,
not a claim that every function signature is identical across releases.

### 4.4 Encrypted solution submission

The player must not submit plaintext bottle identifiers to the contract.

Submission flow:

1.  Frontend collects the final arrangement as five bottle IDs.
2.  Zama SDK encrypts the values for the target contract and connected
    user.
3.  SDK generates the required input proof.
4.  Frontend submits encrypted values and proof.
5.  Contract validates the encrypted input using the current supported
    external-input API, commonly `FHE.fromExternal()`.
6.  Contract compares each submitted position against the corresponding
    encrypted target position using `FHE.eq()`.
7.  Contract combines the five encrypted booleans into one encrypted
    success boolean.
8.  Contract configures the result's ACL and decryption policy.

Conceptual Solidity:

``` solidity
ebool c0 = FHE.eq(target[0], submitted[0]);
ebool c1 = FHE.eq(target[1], submitted[1]);
ebool c2 = FHE.eq(target[2], submitted[2]);
ebool c3 = FHE.eq(target[3], submitted[3]);
ebool c4 = FHE.eq(target[4], submitted[4]);

ebool solved = FHE.and(
    FHE.and(FHE.and(c0, c1), FHE.and(c2, c3)),
    c4
);
```

The real implementation must validate the external input proof, use the
exact current SDK/contract ABI, and apply correct ACL permissions to all
persistent ciphertexts.

### 4.5 ACL and decryption

**Classic --- player-private puzzle and result**

-   Grant the player's wallet permission to decrypt the target and result
    using the current FHE ACL mechanism, such as `FHE.allow()`. This is
    the explicit initial-reveal mechanic, not a hint.
-   Frontend requests user decryption through the current Zama SDK.
-   Never make the target publicly decryptable or grant it to another
    player.
-   Do not create onchain scores or rewards from a player assertion of a
    privately decrypted result. Private user decryption has no onchain
    proof; use the public-decryption proof flow for any onchain reward.

**Daily and Duel --- public result**

-   Mark only the result boolean publicly decryptable using the
    supported public-decryption API, such as
    `FHE.makePubliclyDecryptable()`.
-   Request public decryption through the SDK.
-   Obtain the plaintext result and associated proof.
-   Submit the plaintext and proof to the contract.
-   Verify the proof with the current supported verification function,
    such as `FHE.checkSignatures()`.
-   Finalize the game result.

Public decryption is permanent for the ciphertext. Never apply it to an
active target or submitted arrangement.

### 4.6 Classic reveal policy

Classic is a memory game, not an unknowable random guess. The player's
wallet is authorized to decrypt the target for an initial frontend
reveal. The UI may limit the reveal animation, but that limit is a UX
rule—not a cryptographic enforcement—and must never support rewards.

Do not include selectable target-position hints in Classic: multiple
independent hints let a player reconstruct the complete target.
Competitive modes need a separately designed clue/reveal system before
implementation.

### 4.7 Post-game audit

After a game is terminal, optionally allow the target and winning
submission to become publicly decryptable.

Audit flow:

1.  Game reaches a terminal state.
2.  Contract enables public decryption for the designated audit
    ciphertexts.
3.  Anyone can request plaintext and proof.
4.  Proof is verified.
5.  Auditors compare the revealed target and winning arrangement.

This gives judges a way to inspect the completed game while preserving
secrecy during active gameplay. Never enable this path before the game
is terminal.

------------------------------------------------------------------------

## 5. Smart contract architecture

Use separate logical responsibilities. Contracts may be combined if
deployment size or complexity justifies it, but boundaries must remain
clear.

  -----------------------------------------------------------------------
  Contract                            Responsibility
  ----------------------------------- -----------------------------------
  `ColorSnapGame.sol`                 Game creation, encrypted target,
                                      submission and verification

  `ColorSnapDaily.sol`                Daily challenge lifecycle,
                                      participation and rankings

  `ColorSnapDuel.sol`                 Matchmaking, deposits, deadlines,
                                      winner and refunds

  `ColorSnapPoints.sol`               Non-financial points and
                                      achievements
  -----------------------------------------------------------------------

### 5.1 Enums

``` solidity
enum GameMode {
    CLASSIC,
    DAILY,
    DUEL
}

enum GameStatus {
    NONE,
    WAITING_FOR_PLAYER,
    READY,
    ACTIVE,
    SOLUTION_PENDING,
    CANCELLED,
    EXPIRED
}
```

### 5.2 Game state

Each game should track:

-   Game ID.
-   Game mode.
-   Player A and optional Player B.
-   Creation timestamp.
-   Start timestamp.
-   Deadline.
-   Game status.
-   Five encrypted target handles.
-   Player submission status.
-   Encrypted verification result handles.
-   Submission timestamps.
-   Winner, where applicable.
-   Duel stake tier and escrow reference.
-   Whether settlement or refund has already occurred.

Never store the plaintext target in the game structure.

### 5.3 Core functions

  Function                   Responsibility
  -------------------------- ---------------------------------------
  `createClassicGame()`      Creates an individual puzzle
  `createDailyChallenge()`   Creates the shared daily puzzle
  `joinDailyChallenge()`     Registers a participant
  `createDuel()`             Creates a Duel lobby
  `joinDuel()`               Allows an opponent to join
  `startDuel()`              Generates the common encrypted target
  `submitSolution()`         Accepts encrypted player arrangement
  `finalizeSolution()`       Verifies decryption proof and outcome
  `getPuzzleCiphertexts()`   Returns target ciphertexts to the Classic owner
  `settleDuel()`             Pays the verified winner
  `claimRefund()`            Handles expired or cancelled games

Use custom errors, events for public lifecycle changes,
checks-effects-interactions and reentrancy protection around token
settlement.

Events may contain game IDs, player addresses, status changes and public
outcomes. They must not contain target values, plaintext submissions or
confidential token amounts.

------------------------------------------------------------------------

## 6. Duel tokenomics

### 6.1 Economic model

Use ERC-7984 confidential tokens for Duel entry stakes and rewards.

Suggested initial stake tiers:

  -----------------------------------------------------------------------
  Tier             Entry per player      Combined pool    Winner receives
                                                           after 2.5% fee
  -------------- ------------------ ------------------ ------------------
  Beginner               0.25 cUSDT         0.50 cUSDT       0.4875 cUSDT

  Standard               1.00 cUSDT         2.00 cUSDT         1.95 cUSDT

  High Stakes            5.00 cUSDT        10.00 cUSDT         9.75 cUSDT
  -----------------------------------------------------------------------

Start with Beginner and Standard. Keep High Stakes disabled until
escrow, settlement and security testing are complete.

Amounts are illustrative test-token units, not real-world monetary
valuations.

### 6.2 Protocol fee

Protocol fee: **2.5% of the combined prize pool**.

For two players staking 1 cUSDT:

-   Total pool: 2 cUSDT.
-   Protocol fee: 0.05 cUSDT.
-   Winner receives: 1.95 cUSDT.

Suggested accounting allocation of collected fees:

  Allocation                      Share of collected fees
  ----------------------------- -------------------------
  Protocol treasury                                   50%
  Development and maintenance                         30%
  Community rewards                                   20%

These are accounting allocations. The first implementation may transfer
the fee to a treasury and track the internal allocation offchain. Do not
add complex automatic distributions until the core escrow is secure.

### 6.3 ERC-7984 integration

Use the official Zama Sepolia confidential token registry and verify the
selected token before deployment.

The proposed test token from the registry is:

-   Name: `cUSDTMock`
-   Address: `0x4E7B06D78965594eB5EF5414c357ca21E1554491`
-   Underlying mock token reported by the registry:
    `0xa7dA08FafDC9097Cc0E7D4f113A61e31d7e8e9b0`

Treat these as configuration candidates. Re-check the official registry
and token ABI immediately before implementation and deployment. This is
a test token, not real USDT and not redeemable real-world value.

### 6.4 Deposit lifecycle

Investigate and use the ERC-7984 confidential transfer callback flow,
including `IERC7984Receiver` and `confidentialTransferAndCall()` if
supported by the selected token implementation.

Receiver requirements:

-   Accept only the configured token.
-   Validate sender and game ID.
-   Validate match state.
-   Verify encrypted deposit amount against required stake.
-   Associate the deposit with the correct player and match.
-   Reject invalid deposits.
-   Correctly handle the token's callback and refund semantics.

Avoid unlimited operator approvals where a callback deposit flow is
supported.

### 6.5 Settlement and refunds

-   Winner receives the combined prize pool minus protocol fee.
-   Treasury receives the protocol fee.
-   If neither player succeeds before expiry and the verification grace
    period ends, both players receive refunds.
-   If an opponent does not join, creator can cancel and recover their
    deposit.
-   No unilateral withdrawal after the match starts.
-   Settlement must execute once.
-   Refunds must execute once.
-   A failed transfer must not silently mark funds as paid.

ERC-7984 hides balances and transfer amounts according to its
confidentiality model. If the game publicly publishes a stake tier,
observers can infer the nominal stake. Do not claim that all economic
metadata is hidden.

### 6.6 Economic safety

-   Do not rely on frontend state for deposits or payout eligibility.
-   Do not pay based on an unverified client claim.
-   Do not permit arbitrary tokens.
-   Do not allow a player to change stake after joining.
-   Define behavior for paused tokens, failed callbacks and token
    upgrades.
-   Measure gas and FHE costs before finalizing fees.
-   Do not describe protocol revenue as profit until infrastructure and
    transaction costs are measured.

------------------------------------------------------------------------

## 7. Frontend architecture

### 7.1 Recommended stack

  Layer                   Technology
  ----------------------- ------------------------
  Framework               Next.js
  Language                TypeScript
  Styling                 Tailwind CSS
  UI components           shadcn/ui
  Animation               Framer Motion
  Wallet                  wagmi + viem
  FHE                     `@zama-fhe/sdk`
  React FHE integration   `@zama-fhe/react-sdk`
  Server state            TanStack Query
  Local game state        Zustand or React state

Pin compatible package versions. Check the current Zama SDK
documentation and package registry rather than copying deprecated
examples.

### 7.2 Suggested frontend structure

``` text
frontend/
├── app/
│   ├── page.tsx
│   ├── play/
│   │   ├── classic/
│   │   ├── daily/
│   │   └── duel/
│   ├── leaderboard/
│   ├── profile/
│   └── wallet/
├── components/
│   ├── game/
│   │   ├── Bottle.tsx
│   │   ├── BottleBoard.tsx
│   │   ├── GameTimer.tsx
│   │   ├── MoveCounter.tsx
│   │   ├── GameResult.tsx
│   │   └── HintButton.tsx
│   ├── duel/
│   │   ├── DuelLobby.tsx
│   │   ├── Matchmaking.tsx
│   │   ├── PlayerCard.tsx
│   │   ├── StakeSelector.tsx
│   │   └── PrizePool.tsx
│   └── shared/
├── hooks/
│   ├── useGame.ts
│   ├── useClassicGame.ts
│   ├── useDailyChallenge.ts
│   ├── useDuel.ts
│   ├── useSolutionSubmission.ts
│   └── useConfidentialToken.ts
├── lib/
│   ├── zama/
│   │   ├── config.ts
│   │   ├── encryption.ts
│   │   ├── decryption.ts
│   │   └── permissions.ts
│   ├── contracts/
│   ├── game/
│   │   ├── bottle-utils.ts
│   │   ├── local-game-engine.ts
│   │   └── scoring.ts
│   └── wallet/
└── types/
    ├── game.ts
    ├── duel.ts
    └── contract.ts
```

### 7.3 UX states

The frontend must distinguish:

-   Wallet disconnected.
-   Initializing Zama SDK.
-   Creating game.
-   Generating encrypted puzzle.
-   Ready to play.
-   Playing.
-   Encrypting solution.
-   Waiting for transaction confirmation.
-   Waiting for FHE verification.
-   Decrypting result.
-   Won.
-   Lost.
-   Expired.
-   Settling.
-   Settled.
-   Refund available.
-   Refunded.
-   Error/retryable state.

Never display a win before the relevant proof has been verified and the
game state finalized.

### 7.4 SDK integration

Install the current packages after checking compatibility:

``` bash
pnpm add @zama-fhe/sdk
pnpm add @zama-fhe/react-sdk @tanstack/react-query
pnpm add wagmi viem
```

Use the React provider/hooks where appropriate and the core SDK for
game-specific encrypted input and result workflows.

Do not copy legacy examples based on `createInstance()` from the
deprecated Relayer SDK. Follow the API and configuration for the pinned
current SDK release.

Keep network configuration, contract addresses and token addresses in a
typed deployment configuration. Do not scatter addresses throughout the
UI.

------------------------------------------------------------------------

## 8. Repository structure

``` text
colorsnap/
├── frontend/
├── contracts/
│   ├── contracts/
│   │   ├── ColorSnapGame.sol
│   │   ├── ColorSnapDuel.sol
│   │   ├── ColorSnapDaily.sol
│   │   └── ColorSnapPoints.sol
│   ├── test/
│   │   ├── unit/
│   │   ├── integration/
│   │   ├── security/
│   │   └── fhe/
│   ├── scripts/
│   │   ├── deploy.ts
│   │   ├── verify.ts
│   │   └── configure.ts
│   └── deployments/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── FHE_INTEGRATION.md
│   ├── GAME_MODES.md
│   ├── TOKENOMICS.md
│   ├── SECURITY.md
│   └── DEPLOYMENT.md
├── README.md
├── IMPLEMENTATION_PLAN.md
└── pnpm-workspace.yaml
```

Audit the existing ColorSnap repository before changing it. Preserve
reusable components, tests, styles and gameplay behavior. Do not blindly
overwrite the current implementation.

------------------------------------------------------------------------

## 9. Implementation roadmap

### Phase 0 --- Repository audit

-   Inspect existing contracts, frontend, tests and deployment
    configuration.
-   Identify plaintext target storage, getters, events and logs.
-   Record current functionality.
-   Identify reusable UI components.
-   Create a migration branch.
-   Write an audit report and proposed changes.

**Exit criteria:** Existing architecture is understood and target-leak
risks are documented.

### Phase 1 --- Zama development environment

-   Configure the current FHEVM Hardhat plugin.
-   Pin compatible Solidity and FHEVM dependencies.
-   Configure Sepolia.
-   Install the current Zama SDK.
-   Configure wagmi and viem.
-   Validate encrypted input and decryption round trip.
-   Establish local FHE tests.

**Exit criteria:** A minimal encrypted value can be created, used in a
contract operation and decrypted by the intended party.

### Phase 2 --- Confidential game engine

-   Build `ColorSnapGame.sol`.
-   Implement encrypted random priorities.
-   Implement and test encrypted sorting network.
-   Store encrypted target permutation.
-   Configure ACL permissions.
-   Implement encrypted solution submission.
-   Implement encrypted success/failure calculation.
-   Implement result decryption workflow.

**Exit criteria:** One complete Classic round works with a hidden target
and encrypted verification.

### Phase 3 --- Classic Mode

-   Integrate the existing ColorSnap board.
-   Implement local bottle movement.
-   Add undo, redo and reset.
-   Add timer and move counter.
-   Connect game initialization.
-   Implement encrypted submission.
-   Implement private result decryption.
-   Add clear loading and error states.

**Exit criteria:** A user can play and complete a Classic round on
Sepolia without a transaction for each move.

### Phase 4 --- Daily Challenge

-   Implement daily puzzle creation.
-   Create shared challenge identifiers.
-   Prevent duplicate participation.
-   Design a competitive clue/reveal system; do not reuse Classic's private
    target reveal or position hints.
-   Implement public result verification.
-   Build leaderboard and streaks.
-   Add verification grace period.

**Exit criteria:** Multiple wallets can solve the same daily encrypted
puzzle and have verifiable results.

### Phase 5 --- Duel matchmaking

-   Create Duel lobbies.
-   Implement opponent joining.
-   Generate one common encrypted target.
-   Implement match deadlines.
-   Prevent duplicate submissions.
-   Track original submission timestamps.
-   Implement deterministic winner resolution.

**Exit criteria:** Two players can join and compete against the same
encrypted target.

### Phase 6 --- ERC-7984 and escrow

-   Verify the official Sepolia token and ABI.
-   Integrate ERC-7984.
-   Implement confidential deposit callback.
-   Verify encrypted entry amounts.
-   Implement escrow accounting.
-   Implement winner settlement.
-   Implement refunds, expiry and cancellation.
-   Add reentrancy and duplicate-settlement protection.

**Exit criteria:** A complete Duel can accept stakes, verify a winner
and settle confidential token rewards on Sepolia.

### Phase 7 --- Frontend completion

-   Finish all three mode interfaces.
-   Build Duel lobby and match screen.
-   Add confidential balance views.
-   Add transaction and FHE progress states.
-   Implement public result verification.
-   Add responsive mobile layouts.
-   Add accessible controls and keyboard support.

**Exit criteria:** A new user can understand and complete each mode
without developer assistance.

### Phase 8 --- Testing and security

-   Unit tests.
-   FHE integration tests.
-   Token escrow tests.
-   Adversarial tests.
-   Full Sepolia end-to-end tests.
-   Gas and FHE execution benchmarking.
-   Review all ACL grants and public decryption paths.

**Exit criteria:** All critical gameplay, confidentiality and settlement
tests pass.

### Phase 9 --- Deployment and bounty submission

-   Deploy contracts.
-   Verify contracts on Sepolia explorer.
-   Publish frontend.
-   Publish technical documentation.
-   Prepare three-minute real-person demo.
-   Publish X introduction thread.
-   Submit bounty application.

**Exit criteria:** Public, reproducible end-to-end demonstration is
available.

------------------------------------------------------------------------

## 10. Testing and security requirements

### 10.1 FHE tests

  Test                                 Expected result
  ------------------------------------ ----------------------------------
  Generate target                      Five unique encrypted bottle IDs
  Read target                          No unauthorized plaintext access
  Submit correct arrangement           Encrypted success result
  Submit incorrect arrangement         Encrypted failure result
  Submit invalid encrypted input       Rejected
  Decrypt as authorized player         Correct result returned
  Decrypt as unauthorized user         Access denied
  Reuse ciphertext from another game   Rejected or correctly isolated
  Reveal target before completion      Impossible
  Reveal target after completion       Only through approved audit flow

### 10.2 Game tests

-   Player cannot submit twice.
-   Player cannot submit for another player's game.
-   Expired games cannot be completed.
-   Duel cannot start with only one accepted deposit.
-   Player cannot join their own Duel as opponent.
-   Player cannot withdraw after the match starts.
-   Incorrect solutions cannot trigger payouts.
-   Only a verified successful result can trigger settlement.
-   Concurrent settlement attempts cannot pay twice.
-   Pending verification cannot be mistaken for failure or success.

### 10.3 Token tests

-   Only configured ERC-7984 token is accepted.
-   Deposits must correspond to a valid game.
-   Deposits must match the configured stake.
-   Callback rejection follows the token's documented refund behavior.
-   Winner cannot receive more than escrow balance.
-   Refunds cannot be claimed twice.
-   Reentrancy and malicious callback attempts are rejected.
-   Failed transfers do not silently mark funds as paid.

### 10.4 Security rules

1.  Never store a plaintext target in contract storage.
2.  Never emit target values in events.
3.  Never make an active target publicly decryptable.
4.  Never grant players permission to decrypt the complete target.
5.  Validate encrypted inputs and proofs.
6.  Do not use `block.timestamp`, `blockhash` or `msg.sender` as a
    substitute for confidential randomness.
7.  Keep encrypted handles isolated by game ID.
8.  Restrict public decryption to results that genuinely need public
    verification.
9.  Reveal target and winning submission only after the game is
    terminal, if post-game audit is enabled.
10. Do not trust client-reported time or move counts for financial
    rewards.
11. Protect settlement and refund functions against reentrancy and
    duplicate execution.
12. Document every ACL permission and its purpose.

------------------------------------------------------------------------

## 11. Deployment and environments

Use three environments:

  -----------------------------------------------------------------------
  Environment                         Purpose
  ----------------------------------- -----------------------------------
  Hardhat in-memory                   Fast unit tests with mock
                                      encryption

  Hardhat local node                  Persistent integration tests with
                                      mock encryption

  Sepolia                             Real encrypted inputs, FHE
                                      operations and final deployment
  -----------------------------------------------------------------------

Local mock environments do not replace Sepolia testing.

### Deployment order

1.  Deploy and configure game engine.
2.  Deploy Daily Challenge contract.
3.  Deploy Duel contract.
4.  Configure ERC-7984 token address.
5.  Configure treasury.
6.  Test confidential deposits.
7.  Test encrypted target generation.
8.  Test private and public result decryption.
9.  Test successful and unsuccessful Duel settlement.
10. Test expiry and refunds.
11. Verify contracts on Sepolia explorer.
12. Configure frontend with verified addresses.

All addresses and network settings must live in a deployment
configuration file.

------------------------------------------------------------------------

## 12. Bounty deliverables

  Deliverable         Expected output
  ------------------- ------------------------------------------------
  Smart contracts     FHE-enabled Solidity contracts
  Frontend            Fully playable responsive application
  FHE integration     Encrypted target, inputs and verification
  Token integration   ERC-7984 cUSDTMock Duel economy
  Deployment          Verified Sepolia contracts
  Tests               Unit, integration, security and FHE tests
  Documentation       Architecture, setup, game rules and tokenomics
  Demo                Three-minute real-person video
  X introduction      Project announcement/thread

### 12.1 Three-minute demo

  Time         Demonstration
  ------------ ---------------------------------------------------------
  0:00--0:25   Introduce ColorSnap and the confidentiality problem
  0:25--0:55   Show encrypted target generation
  0:55--1:30   Play Classic Mode and submit a solution
  1:30--2:05   Demonstrate Duel matchmaking and cUSDT stakes
  2:05--2:35   Show encrypted verification and winner settlement
  2:35--3:00   Demonstrate post-game audit and explain why FHE matters

Use actual Sepolia interactions, not only frontend mockups. The pitch
must be delivered by a real person; do not use AI-generated video or
voice.

------------------------------------------------------------------------

## 13. Suggested 26-day schedule

The bounty deadline provided in the brief is December 14, 2026 at 23:59
AOE. The following is an aggressive schedule beginning November 18.

  Dates        Work
  ------------ --------------------------------------
  Nov 18--20   Repository audit and FHE environment
  Nov 21--24   Encrypted game engine
  Nov 25--27   Classic Mode
  Nov 28--30   Daily Challenge
  Dec 1--4     Duel matchmaking
  Dec 5--7     ERC-7984 escrow and tokenomics
  Dec 8--10    Integration and security testing
  Dec 11--12   Sepolia deployment and documentation
  Dec 13       Demo and X announcement
  Dec 14       Final submission and contingency

If time becomes tight, prioritize a fully functioning Classic Mode and
Duel Mode over decorative features or expansion of the token economy.

------------------------------------------------------------------------

## 14. Codex execution instructions

Codex must follow these rules:

-   Audit the existing repository before modifying it.
-   Preserve existing working functionality where possible.
-   Do not rebuild reusable components unnecessarily.
-   Do not expose plaintext targets through events, getters, logs or
    frontend state.
-   Do not use frontend-only verification for financial rewards.
-   Do not trust client-reported timestamps or move counts for financial
    ranking.
-   Do not use the deprecated Zama Relayer SDK.
-   Pin and document compatible SDK, Solidity, FHEVM and OpenZeppelin
    versions.
-   Do not assume API signatures from old examples; inspect installed
    package types and current official documentation.
-   Do not deploy untested escrow logic.
-   Keep FHE computations as small as practical.
-   Document every ACL permission.
-   Use Sepolia real encryption for final acceptance testing.
-   Keep frontend, contracts and docs independently maintainable.
-   Write tests alongside each phase.
-   Do not proceed to the next major phase while the current phase's
    acceptance criteria fail.

### First task for Codex

Start with Phase 0 only.

Inspect the existing repository and produce:

1.  Current architecture summary.
2.  Existing contract and frontend inventory.
3.  Existing game lifecycle.
4.  Plaintext target exposure audit.
5.  Reusable components and logic.
6.  Dependency and compiler compatibility report.
7.  Migration plan.
8.  Risks and unresolved technical questions.

Do not start a wholesale rewrite before presenting the audit findings.

------------------------------------------------------------------------

## 15. Technical references

Use official documentation as the source of truth. Re-check API
signatures, package versions and network addresses before
implementation.

-   [Zama Protocol documentation](https://docs.zama.org/protocol)
-   [Zama Quick Start
    Tutorial](https://docs.zama.org/protocol/solidity-guides/getting-started/quick-start-tutorial)
-   [Encrypted random
    numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)
-   [Zama FHEVM Hardhat
    template](https://github.com/zama-ai/fhevm-hardhat-template)
-   [FHEVM examples](https://docs.zama.org/protocol/examples/)
-   [OpenZeppelin Confidential
    Contracts](https://github.com/OpenZeppelin/openzeppelin-confidential-contracts)
-   [Official Sepolia confidential token
    registry](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia)
-   [ERC-7984 standard](https://eips.ethereum.org/EIPS/eip-7984)

------------------------------------------------------------------------

## 16. Final architecture decisions

These decisions should remain stable unless a technical proof
demonstrates that a change is necessary:

1.  **Classic private target reveal.** The Classic owner may decrypt
    their target for an initial memory-game reveal. It is never publicly
    decryptable or available to another player; competitive modes require
    a separate design.
2.  **Local bottle interactions.** All swaps are instant; blockchain
    handles creation, submissions, verification and settlement.
3.  **Publicly verifiable outcomes.** Reveal the result, not the secret
    arrangement, during play.
4.  **Confidential Duel economy.** Use ERC-7984 for stakes and rewards.
5.  **Deterministic winner resolution.** Use original onchain submission
    timestamps and verified outcomes, not asynchronous callback order.
6.  **Post-game audit.** Optionally reveal target and winning
    arrangement only after terminal state.
7.  **Ship a complete game first.** A reliable end-to-end confidential
    game is more valuable than several incomplete modes.

**Definition of done:** A player can create a game, play without
per-move transactions, submit an encrypted arrangement, receive a
correctly authorized and verifiable result, and---when playing
Duel---complete a confidential-token stake and settlement flow on
Sepolia.
