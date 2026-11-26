# Frontend Contracts

Canonical frontend integration point for ColorSnap Sepolia contracts.

## What lives here

- `index.ts` - deployed addresses, env overrides, and typed ABI exports.
- `abis/` - Foundry-generated ABI JSON files.
- `narrowAbis.ts` - narrow literal ABIs for wagmi typed contract calls.

## Usage

```ts
import {
  SEPOLIA_CHAIN_ID,
  SEPOLIA_CONTRACTS,
  colorSnapGameAbi,
  colorSnapChallengeAbi,
  colorSnapDailyAbi,
  colorSnapDuelAbi,
  colorSnapDuelEscrowAbi,
  colorSnapTestTokenAbi,
} from "@/contracts";
```

## Refresh ABIs after rebuild/redeploy

From the repository root:

```bash
bash scripts/export-frontend-abis.sh
```

If contract addresses change, update the defaults in `index.ts` and the `NEXT_PUBLIC_COLOR_SNAP_*` values in `frontend/.env.example`.
