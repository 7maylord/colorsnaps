# ColorSnap Confidential Gaming

ColorSnap is a private color-memory game built with Zama FHEVM on Ethereum Sepolia. Players briefly view a randomly generated color pattern, recreate it, and submit an encrypted solution. The pattern and individual result remain confidential on-chain.

## What is private

- Classic target patterns and submitted solutions are encrypted FHE ciphertexts.
- Only the player can request decryption of their Classic puzzle and result with a wallet-signed permit.
- Multiplayer challenges share a private target while publishing only a proof-verified win/loss outcome.
- Duels use confidential ERC-7984 stakes; escrow accepts only proof-verified stake amounts before the FHE referee settles the match.

## Ethereum Sepolia deployment

Chain ID: `11155111`

| Contract | Address | Explorer |
| --- | --- | --- |
| ColorSnapGame | `0x09f73868172Fca7c85EfB5b51647f07b21709Ddd` | [Verified](https://sepolia.etherscan.io/address/0x09f73868172Fca7c85EfB5b51647f07b21709Ddd) |
| ColorSnapChallenge | `0x15B206013E0A45313Ef3ab58574E54Aa71eC4A20` | [Verified](https://sepolia.etherscan.io/address/0x15B206013E0A45313Ef3ab58574E54Aa71eC4A20) |
| ColorSnapDaily | `0xA8486339E1E8622aE7C6466f4DB45b97150550d8` | [Verified](https://sepolia.etherscan.io/address/0xA8486339E1E8622aE7C6466f4DB45b97150550d8) |
| ColorSnap Test USD (ERC-7984) | `0x62b38bd2B065029D1d45d55Ef78123a7e3C5b224` | [Verified](https://sepolia.etherscan.io/address/0x62b38bd2B065029D1d45d55Ef78123a7e3C5b224) |
| ColorSnapDuelEscrow | `0xA7860b957e7c75F6CeF2cdDa9ACdBcBce60A8338` | [Verified](https://sepolia.etherscan.io/address/0xA7860b957e7c75F6CeF2cdDa9ACdBcBce60A8338) |
| ColorSnapDuel | `0x220b324D83450Da7C0F69ff949403B2FC7B27762` | [Verified](https://sepolia.etherscan.io/address/0x220b324D83450Da7C0F69ff949403B2FC7B27762) |

The test cUSD token is intentionally public-mint for Sepolia testing only. It has no value and must not be used as a production asset.

## Repository layout

```text
smart-contracts/  Foundry contracts, deployment script, and FHE tests
frontend/         Next.js client with Reown/Wagmi and the Zama FHEVM SDK
scripts/          ABI export tooling
```

## Smart contracts

```bash
cd smart-contracts
forge test --offline --disable-labels
```

The deployment script deploys the full stack—Classic game, Challenge, test cUSD, Duel Escrow, Duel referee—and wires the escrow referee in the same broadcast.

```bash
set -a
source .env
set +a

forge script script/Colorsnap.s.sol:ColorSnapScript \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --ffi \
  --gas-estimate-multiplier 2000
```

The high multiplier is a transaction gas ceiling, not a prepaid allocation: the chain charges only gas actually used. `--ffi` enables the script's optional Etherscan verification command.

## Frontend

```bash
cd frontend
yarn install
cp .env.example .env.local
yarn build
```

Set `NEXT_PUBLIC_PROJECT_ID` in `.env.local`. The verified Sepolia addresses are provided in `.env.example` and can be overridden only for a deliberate redeployment.

All frontend contract integration is centralized in `frontend/src/contracts`:

- `index.ts` exports the canonical typed addresses and ABIs.
- `abis/` contains Foundry-generated ABI artifacts for every deployed contract.
- Components import from `@/contracts`; they do not hardcode contract addresses.

Refresh the ABI artifacts after a contract build or redeployment:

```bash
bash scripts/export-frontend-abis.sh
```

## Confidential game flow

1. Connect an Ethereum Sepolia wallet.
2. Create a Classic game; the contract produces an encrypted target pattern.
3. Your wallet signs a scoped decryption permit to display the pattern briefly.
4. Arrange the colors and encrypt the submission in the browser with `@fhevm/sdk`.
5. The contract evaluates the encrypted solution and returns an encrypted boolean result.
6. For challenges and duels, the public result is finalized only with a KMS decryption proof.

## Development notes

- This project targets Zama FHEVM on Ethereum Sepolia; old multi-network game deployments are intentionally not part of the current product direction.
- Never place private keys in frontend environment variables.
- Test with Sepolia ETH for gas. The test cUSD is for confidential duel-flow testing only.
