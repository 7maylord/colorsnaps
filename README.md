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
| ColorSnapGame | `0x24147D3cc6B12Ec9BA369F3eA4429849bEe301E9` | [Verified](https://sepolia.etherscan.io/address/0x24147D3cc6B12Ec9BA369F3eA4429849bEe301E9) |
| ColorSnapChallenge | `0xC2039aC0aEd807B89e46A1F87704A9827De58227` | [Verified](https://sepolia.etherscan.io/address/0xC2039aC0aEd807B89e46A1F87704A9827De58227) |
| ColorSnap Test USD (ERC-7984) | `0x4A4ABFc95544b0199c19354Dd4Cbb47047eC925E` | [Verified](https://sepolia.etherscan.io/address/0x4A4ABFc95544b0199c19354Dd4Cbb47047eC925E) |
| ColorSnapDuelEscrow | `0xf634e0339F1a9A74C952D31bE5e3E021cA345e89` | [Verified](https://sepolia.etherscan.io/address/0xf634e0339F1a9A74C952D31bE5e3E021cA345e89) |
| ColorSnapDuel | `0x4Bf590486e09c145ccf5F581E8197be275107de3` | [Verified](https://sepolia.etherscan.io/address/0x4Bf590486e09c145ccf5F581E8197be275107de3) |

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
