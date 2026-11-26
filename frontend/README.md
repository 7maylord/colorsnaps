# ColorSnap frontend

ColorSnap is a confidential color memory game on Ethereum Sepolia. Sign in with a wallet or email through Reown AppKit, choose a mode, and play with Zama FHEVM.

After sign-in, choose a callsign on the mode screen. Saving it signs a Sepolia transaction to the public player registry; the same name appears on the Daily leaderboard across devices. Games and results remain keyed by wallet address. Each mode opens a short field guide on first visit, and its **How to play** button reopens the guide.

## Run locally

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set `NEXT_PUBLIC_PROJECT_ID` in `.env.local`. In the Reown dashboard, enable email login and allow the exact origins you use: `http://localhost:3000`, `http://localhost:3002`, your preview URL, and production URL. A browser extension can also reject an origin independently of Reown; test in a clean browser profile if that happens.

The Sepolia addresses are in `.env.example` and `src/contracts/index.ts`. `src/contracts/abis/` contains the exported Foundry ABIs. From the repository root, run `bash scripts/export-frontend-abis.sh` after a contract build.

## Modes

- **Classic:** Private five-second reveal, untimed rearrangement, encrypted submission, and private result decryption. The active game ID and pending transaction hash are scoped to the chain, contract, and account for refresh recovery.
- **Daily:** One shared puzzle per UTC day. The contract enforces one submission; a KMS proof makes only win/loss public for ranking.
- **Leaderboard:** The current UTC day's proof-verified Daily winners are ranked by submission time. A separate public registry supplies wallet-owned callsigns; an address is shown when no name exists. Classic has no public result, so it cannot contribute a verifiable score.
- **Challenge:** Create or join with an invite ID. The five-minute contract deadline begins when the second player joins. Each result needs a public proof before resolution.
- **Duel:** Public-mint test cUSD funds confidential ERC-7984 stakes. Each deposit and game result needs a proof. The frontend checks for timeout recovery before enabling deposits.

All modes require Sepolia ETH for transaction gas. Test cUSD has no real value.

## Build

```bash
pnpm build
```

The build uses webpack because Turbopack's CSS worker cannot open a local port in some restricted development environments.

The FHE client configures and initializes the browser runtime before Classic sends a creation transaction. If a previous attempt created a puzzle before private reveal failed, the Classic screen resumes the latest game for that address on refresh.
